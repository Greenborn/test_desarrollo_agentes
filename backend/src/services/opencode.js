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

  stop() {
    if (this.process) {
      this.process.kill();
      this.process = null;
      this.ready = false;
    }
  }

  async api(path, options = {}) {
    const url = `${this.baseUrl()}${path}`;
    const res = await fetch(url, {
      headers: { 'Content-Type': 'application/json', ...options.headers },
      ...options,
    });
    if (!res.ok) {
      const text = await res.text();
      throw new Error(`OpenCode API error ${res.status}: ${text}`);
    }
    return res.json();
  }

  async createSession(title) {
    return this.api('/session', {
      method: 'POST',
      body: JSON.stringify({ title: title || 'Agent Orchestrator session' }),
    });
  }

  async sendPromptAsync(sessionId, parts, options = {}) {
    const body = {
      parts: Array.isArray(parts) ? parts : [{ type: 'text', text: parts }],
      ...options,
    };
    await fetch(`${this.baseUrl()}/session/${sessionId}/prompt_async`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    });
  }

  async* streamSession(sessionId, parts, options = {}) {
    const eventRes = await fetch(`${this.baseUrl()}/event`);
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
        console.log(`[opencode ${this.port}] error leyendo evento:`, readErr.message);
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
    reader.cancel();
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
    const res = await fetch(`${this.baseUrl()}/session/${sessionId}/message`);
    if (!res.ok) return [];
    return res.json();
  }
}

async function getOrStartServer(directory, locale) {
  if (servers[directory]) return servers[directory];
  const port = nextPort++;
  const srv = new OpenCodeServer(directory, port, locale);
  servers[directory] = srv;
  await srv.start();
  await srv.waitForReady();
  return srv;
}

function stopServer(directory) {
  if (servers[directory]) {
    servers[directory].stop();
    delete servers[directory];
  }
}

function stopAllServers() {
  for (const dir of Object.keys(servers)) {
    servers[dir].stop();
  }
}

async function getModels(directory, locale) {
  const server = await getOrStartServer(directory, locale);
  return server.api('/config/providers');
}

async function abortSessionInDir(directory, ocSessionId) {
  if (servers[directory]) {
    await servers[directory].abortSession(ocSessionId);
  }
}

async function abortSession(ocSessionId) {
  for (const dir of Object.keys(servers)) {
    try {
      await servers[dir].abortSession(ocSessionId);
      return;
    } catch (abortErr) {
      console.log(`[opencode] abortSession falló en ${dir}:`, abortErr.message);
    }
  }
}

export default {
  getOrStartServer,
  stopServer,
  stopAllServers,
  getModels,
  abortSessionInDir,
  abortSession,
};
