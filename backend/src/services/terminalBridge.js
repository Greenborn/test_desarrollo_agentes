// Bridge de terminales: consume el servicio externo `api_procesos_consola` (HTTP + WS)
// SIN modificarlo, y replica sus terminales en ejecución hacia el Component Hub.
//
// - Descubrimiento: consulta GET /api/terminal?chatSessionId=... (HTTP, con X-API-Key).
// - Streaming: abre un cliente WS por terminal (ws://host/?terminalId=X) y reenvía los
//   eventos data/exit al hub. Poll periódico para detectar terminales nuevas.
// - Input/Resize: se reenvían por el mismo WS del bridge hacia el PTY real.
//
// Nota de contención: api_procesos_consola sólo admite UN consumidor WS por terminal
// (attachWebSocket cierra el anterior). Si el frontend local tiene la terminal abierta,
// el bridge y el frontend se alternan el WS; se mitiga con reconexión automática en ambos.

import http from 'http';
import { WebSocket } from 'ws';
import * as hub from './componentHub.js';

const HOST = process.env.PROCESOS_CONSOLA_HOST || 'localhost';
const PORT = process.env.SERVICIO_PROCESOS_CONSOLA_PORT || 3575;
const API_KEY = process.env.PROCESOS_CONSOLA_API_KEY || '';

const POLL_INTERVAL_MS = 4000;
const RECONNECT_BASE_MS = 2000;
const RECONNECT_MAX_MS = 15000;

// sessionId -> { terminalIds:Set, sockets:Map<terminalId, ws>, timers:Map<terminalId, timeout>, poll: timeout }
const sessions = new Map();

function httpGet(path) {
  return new Promise((resolve) => {
    const options = {
      hostname: HOST,
      port: PORT,
      path,
      method: 'GET',
      headers: { 'X-API-Key': API_KEY },
      timeout: 3000,
    };
    const req = http.request(options, (res) => {
      let data = '';
      res.on('data', (chunk) => { data += chunk; });
      res.on('end', () => {
        try {
          resolve({ ok: true, body: JSON.parse(data) });
        } catch (err) {
          resolve({ ok: false, error: 'respuesta inválida', raw: data });
        }
      });
    });
    req.on('error', (err) => resolve({ ok: false, error: err.message }));
    req.on('timeout', () => { req.destroy(new Error('timeout')); });
    req.end();
  });
}

function buildWsUrl(terminalId) {
  return `ws://${HOST}:${PORT}/?terminalId=${encodeURIComponent(terminalId)}`;
}

function labelForTerminal(t) {
  return (t && t.cmd) ? `Terminal: ${t.cmd}` : 'Terminal';
}

function openSocket(sessionId, terminal) {
  const sid = sessions.get(sessionId);
  if (!sid) return;

  const terminalId = terminal.terminalId;
  // Asegurar que el componente exista en el hub
  if (!hub.getComponent(terminalId)) {
    hub.register({
      componentId: terminalId,
      kind: 'terminal',
      sessionId,
      label: labelForTerminal(terminal),
      meta: { cwd: terminal.cwd, cmd: terminal.cmd, pid: terminal.pid || null },
    });
  }

  let ws;
  try {
    ws = new WebSocket(buildWsUrl(terminalId));
  } catch (err) {
    console.log('[terminalBridge] error creando WS:', err.message);
    scheduleReconnect(sessionId, terminal, RECONNECT_BASE_MS);
    return;
  }

  sid.sockets.set(terminalId, ws);
  let exited = false;

  ws.on('open', () => {
    console.log(`[terminalBridge] WS conectado terminal ${terminalId} (sesión ${sessionId})`);
  });

  ws.on('message', (raw) => {
    let msg;
    try {
      msg = JSON.parse(raw.toString());
    } catch (err) {
      return;
    }
    if (msg.type === 'data') {
      hub.pushEvent(terminalId, { type: 'data', data: msg.data });
    } else if (msg.type === 'exit') {
      exited = true;
      hub.finalize(terminalId, {
        status: 'exited',
        evt: { type: 'exit', code: msg.code, signal: msg.signal, output: msg.output },
      });
      try { ws.close(); } catch (err) { /* noop */ }
    } else if (msg.type === 'created') {
      hub.pushEvent(terminalId, { type: 'created' });
    } else if (msg.type === 'error') {
      hub.pushEvent(terminalId, { type: 'error', message: msg.message });
    }
  });

  ws.on('close', () => {
    sid.sockets.delete(terminalId);
    if (sid.timers.get(terminalId)) {
      clearTimeout(sid.timers.get(terminalId));
      sid.timers.delete(terminalId);
    }
    // Reintentar mientras la terminal siga en la lista (todavía existe en el servicio)
    if (!exited) {
      scheduleReconnect(sessionId, terminal, RECONNECT_BASE_MS);
    }
  });

  ws.on('error', (err) => {
    console.log(`[terminalBridge] WS error terminal ${terminalId}:`, err.message);
  });
}

function scheduleReconnect(sessionId, terminal, delay) {
  const sid = sessions.get(sessionId);
  if (!sid) return;
  if (sid.timers.has(terminal.terminalId)) return;
  const t = setTimeout(() => {
    sid.timers.delete(terminal.terminalId);
    openSocket(sessionId, terminal);
  }, delay);
  sid.timers.set(terminal.terminalId, t);
}

async function refresh(sessionId) {
  const sid = sessions.get(sessionId);
  if (!sid) return;
  const res = await httpGet(`/api/terminal?chatSessionId=${encodeURIComponent(sessionId)}`);
  if (!res.ok || !Array.isArray(res.body)) return;

  const seen = new Set();
  for (const t of res.body) {
    seen.add(t.terminalId);
    if (!sid.sockets.has(t.terminalId) && !sid.timers.has(t.terminalId)) {
      openSocket(sessionId, t);
    }
  }

  // Finalizar componentes que ya no existen en el servicio y no tienen WS abierto
  for (const terminalId of Array.from(sid.terminalIds)) {
    if (!seen.has(terminalId) && !sid.sockets.has(terminalId)) {
      const comp = hub.getComponent(terminalId);
      if (comp && comp.status === 'running') {
        hub.finalize(terminalId, { status: 'removed', evt: { type: 'removed' } });
      }
      sid.terminalIds.delete(terminalId);
    }
  }

  for (const id of seen) sid.terminalIds.add(id);
}

// Activa el monitoreo de una sesión. Idempotente.
export function ensureSession(sessionId) {
  if (!sessionId) return;
  const sid = sessions.get(sessionId);
  if (sid) {
    refresh(sessionId);
    return;
  }
  sessions.set(sessionId, {
    terminalIds: new Set(),
    sockets: new Map(),
    timers: new Map(),
    poll: null,
  });
  const poll = setInterval(() => refresh(sessionId), POLL_INTERVAL_MS);
  sessions.get(sessionId).poll = poll;
  refresh(sessionId);
}

// Envía input a una terminal por el WS del bridge.
export function sendInput(sessionId, terminalId, data) {
  const sid = sessions.get(sessionId);
  const ws = sid && sid.sockets.get(terminalId);
  if (ws && ws.readyState === WebSocket.OPEN) {
    ws.send(JSON.stringify({ type: 'input', data }));
    return { success: true };
  }
  return { success: false, error: 'terminal sin conexión WS del bridge' };
}

export function resize(sessionId, terminalId, cols, rows) {
  const sid = sessions.get(sessionId);
  const ws = sid && sid.sockets.get(terminalId);
  if (ws && ws.readyState === WebSocket.OPEN) {
    ws.send(JSON.stringify({ type: 'resize', cols, rows }));
    return { success: true };
  }
  return { success: false, error: 'terminal sin conexión WS del bridge' };
}

// Detiene el monitoreo de una sesión.
export function stopSession(sessionId) {
  const sid = sessions.get(sessionId);
  if (!sid) return;
  if (sid.poll) clearInterval(sid.poll);
  for (const [terminalId, ws] of sid.sockets.entries()) {
    try { ws.close(); } catch (err) { /* noop */ }
  }
  for (const t of sid.timers.values()) clearTimeout(t);
  sessions.delete(sessionId);
}

export function stopAll() {
  for (const sessionId of Array.from(sessions.keys())) {
    stopSession(sessionId);
  }
}

export default {
  ensureSession,
  sendInput,
  resize,
  stopSession,
  stopAll,
};
