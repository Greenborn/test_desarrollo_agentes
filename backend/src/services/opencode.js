import { spawn } from 'child_process';

const servers = {};
if (!process.env.OPENCODE_PORT) {
  throw new Error('OPENCODE_PORT no está definido en el archivo .env');
}
const parsedPort = parseInt(process.env.OPENCODE_PORT, 10);
if (isNaN(parsedPort) || parsedPort <= 0) {
  throw new Error(`OPENCODE_PORT debe ser un número de puerto válido, recibido: ${process.env.OPENCODE_PORT}`);
}
let nextPort = parsedPort;

class OpenCodeServer {
  constructor(directory, port, locale) {
    this.directory = directory;
    this.port = port;
    this.locale = locale || 'es_ES.UTF-8';
    this.process = null;
    this.ready = false;
    this._abortController = null;
  }

  baseUrl() {
    return `http://localhost:${this.port}`;
  }

  start() {
    return new Promise((resolve, reject) => {
      this.process = spawn('opencode', ['serve', '--port', String(this.port)], {
        stdio: ['ignore', 'pipe', 'pipe'],
        env: { ...process.env, LANG: this.locale, LC_ALL: this.locale },
        cwd: this.directory,
      });

      const timeout = setTimeout(() => {
        reject(new Error(`Timeout esperando que opencode sirva en ${this.directory}`));
      }, 15000);

      const onData = (data) => {
        const text = data.toString();
        console.log(`[opencode ${this.port}]`, text.trim());
        if (text.includes('listening') || text.includes('Server')) {
          this.ready = true;
          clearTimeout(timeout);
          resolve();
        }
      };

      this.process.stdout.on('data', onData);
      this.process.stderr.on('data', onData);

      this.process.on('exit', (code) => {
        console.log(`[opencode ${this.port}] proceso terminado, código:`, code);
        this.process = null;
        this.ready = false;
        clearTimeout(timeout);
      });

      this.process.on('error', (err) => {
        console.log(`[opencode ${this.port}] error al iniciar:`, err.message);
        this.process = null;
        this.ready = false;
        clearTimeout(timeout);
        reject(err);
      });
    });
  }

  async waitForReady() {
    if (this.ready) return;
    const start = Date.now();
    while (!this.ready) {
      if (Date.now() - start > 15000) throw new Error('Timeout esperando que opencode sirva');
      try {
        const res = await fetch(`${this.baseUrl()}/global/health`);
        if (res.ok) { this.ready = true; return; }
      } catch (healthErr) {
        console.log(`[opencode ${this.port}] health check falló:`, healthErr.message);
      }
      await new Promise((r) => setTimeout(r, 300));
    }
  }

  _ensureAbortController() {
    if (!this._abortController || this._abortController.signal.aborted) {
      this._abortController = new AbortController();
    }
    return this._abortController;
  }

  stop() {
    if (this._abortController) {
      this._abortController.abort();
      this._abortController = null;
    }
    if (this.process) {
      this.process.kill();
      this.process = null;
      this.ready = false;
    }
  }

  async isAlive() {
    try {
      const res = await fetch(`${this.baseUrl()}/global/health`, { signal: AbortSignal.timeout(3000) });
      return res.ok;
    } catch {
      return false;
    }
  }

  async api(path, options = {}) {
    const url = `${this.baseUrl()}${path}`;
    const ac = this._ensureAbortController();
    const res = await fetch(url, {
      ...options,
      headers: { 'Content-Type': 'application/json', ...options.headers },
      signal: ac.signal,
    });
    if (!res.ok) {
      const text = await res.text();
      throw new Error(`OpenCode API error ${res.status}: ${text}`);
    }
    return res.json();
  }

  async createSession(title, agent = null) {
    const body = { title: title || 'Agent Orchestrator session' };
    if (agent) body.agent = agent;
    return this.api('/session', {
      method: 'POST',
      body: JSON.stringify(body),
    });
  }

  async sendPromptAsync(sessionId, parts, options = {}) {
    const body = {
      parts: Array.isArray(parts) ? parts : [{ type: 'text', text: parts }],
      ...options,
    };
    const ac = this._ensureAbortController();
    const res = await fetch(`${this.baseUrl()}/session/${sessionId}/prompt_async`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
      signal: ac.signal,
    });
    if (!res.ok) {
      const text = await res.text();
      throw new Error(`Error al enviar prompt a sesión ${sessionId}: ${res.status} ${text}`);
    }
  }

  async* streamSession(sessionId, parts, options = {}) {
    const ac = this._ensureAbortController();
    const eventRes = await fetch(`${this.baseUrl()}/event`, { signal: ac.signal });
    if (!eventRes.ok || !eventRes.body) {
      throw new Error('No se pudo conectar al stream de eventos de OpenCode');
    }

    await this.sendPromptAsync(sessionId, parts, options);

    const reader = eventRes.body.getReader();
    const decoder = new TextDecoder();
    let buffer = '';
    let done = false;

    while (!done) {
      let readerResult;
      try {
        readerResult = await reader.read();
      } catch (readErr) {
        if (readErr.name === 'AbortError') {
          console.log(`[opencode ${this.port}] stream abortado por stop()`);
        } else {
          console.log(`[opencode ${this.port}] error leyendo evento:`, readErr.message);
        }
        break;
      }
      const { done: readerDone, value } = readerResult;
      if (readerDone) break;

      buffer += decoder.decode(value, { stream: true });
      const lines = buffer.split('\n');
      const last = lines.pop();
      buffer = last !== undefined ? last : '';

      for (const line of lines) {
        const trimmed = line.trim();
        if (!trimmed || !trimmed.startsWith('data: ')) continue;
        try {
          const event = JSON.parse(trimmed.slice(6));
          yield event;
          if (event.type === 'session.status' && event.properties?.status?.type === 'idle') {
            done = true;
          }
        } catch (parseErr) {
          console.log(`[opencode ${this.port}] error parseando evento SSE:`, parseErr.message);
        }
      }
    }
    try {
      reader.cancel();
    } catch (cancelErr) {
      console.log(`[opencode ${this.port}] error cancelando reader:`, cancelErr.message);
    }
  }

  async respondToPermission(sessionId, permissionId, response, remember) {
    return this.api(`/session/${sessionId}/permissions/${permissionId}`, {
      method: 'POST',
      body: JSON.stringify({ response, remember: remember || false }),
    });
  }

  async abortSession(sessionId) {
    await this.api(`/session/${sessionId}/abort`, { method: 'POST' });
  }

  async getSessionDiff(sessionId) {
    return this.api(`/session/${sessionId}/diff`);
  }

  async getSessionMessages(sessionId) {
    const ac = this._ensureAbortController();
    try {
      const res = await fetch(`${this.baseUrl()}/session/${sessionId}/message`, { signal: ac.signal });
      if (!res.ok) return [];
      return res.json();
    } catch (msgErr) {
      if (msgErr.name === 'AbortError') {
        console.log(`[opencode ${this.port}] getSessionMessages abortado`);
      } else {
        console.log(`[opencode ${this.port}] error en getSessionMessages:`, msgErr.message);
      }
      return [];
    }
  }
}

async function getOrStartServer(directory, chatSessionId, locale, customKey = null) {
  const key = customKey || chatSessionId || `dir_${directory}`;
  if (key && servers[key]) {
    const alive = await servers[key].server.isAlive();
    if (alive) return servers[key].server;
    console.log(`[opencode] servidor ${key} no responde, limpiando y reiniciando`);
    servers[key].server.stop();
    delete servers[key];
  }
  const port = nextPort++;
  const srv = new OpenCodeServer(directory, port, locale);
  if (key) {
    servers[key] = { server: srv, directory };
  }
  await srv.start();
  await srv.waitForReady();
  return srv;
}

function stopServer(chatSessionId) {
  if (servers[chatSessionId]) {
    servers[chatSessionId].server.stop();
    delete servers[chatSessionId];
  }
}

function stopServerByDirectory(directory) {
  for (const [key, entry] of Object.entries(servers)) {
    if (entry.directory === directory) {
      entry.server.stop();
      delete servers[key];
    }
  }
}

function stopEditorServer(directory) {
  const key = `editor_${directory}`;
  if (servers[key]) {
    servers[key].server.stop();
    delete servers[key];
  }
}

function stopAllServers() {
  for (const entry of Object.values(servers)) {
    entry.server.stop();
  }
}

async function getModels(directory, chatSessionId, locale, customKey = null) {
  const server = await getOrStartServer(directory, chatSessionId, locale, customKey);
  return server.api('/config/providers');
}

async function abortSessionInDir(key, ocSessionId) {
  if (servers[key]) {
    await servers[key].server.abortSession(ocSessionId);
  }
}

async function abortSession(ocSessionId) {
  for (const [csId, entry] of Object.entries(servers)) {
    try {
      await entry.server.abortSession(ocSessionId);
      return;
    } catch (abortErr) {
      console.log(`[opencode] abortSession falló en sesión ${csId}:`, abortErr.message);
    }
  }
}

export default {
  getOrStartServer,
  stopServer,
  stopServerByDirectory,
  stopEditorServer,
  stopAllServers,
  getModels,
  abortSessionInDir,
  abortSession,
};
