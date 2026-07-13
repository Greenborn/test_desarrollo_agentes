import { spawn } from 'node-pty';
import crypto from 'crypto';
import memoriaClient from './memoriaClient.js';

const terminals = new Map();

function generateId() {
  return crypto.randomBytes(12).toString('hex');
}

export function createTerminalRecord({ chatSessionId, cwd, cmd }) {
  const terminalId = generateId();
  const record = {
    terminalId,
    chatSessionId,
    cwd: cwd || process.env.CWD || process.cwd(),
    cmd: cmd || null,
    createdAt: new Date().toISOString(),
    status: 'pending',
    pty: null,
    ws: null,
  };
  terminals.set(terminalId, record);

  memoriaClient.set('procesos_consola', `terminal:${terminalId}`, {
    terminalId,
    chatSessionId: record.chatSessionId,
    cwd: record.cwd,
    cmd: record.cmd,
    createdAt: record.createdAt,
    status: 'pending',
  }).catch(err => console.log('[procesos_consola] Error al guardar terminal en memoria:', err.message));
  updateChatIndex(chatSessionId, terminalId, 'add').catch(err => console.log('[procesos_consola] Error al actualizar índice de chat_terminals:', err.message));

  return terminalId;
}

export function hasActivePty(terminalId) {
  const record = terminals.get(terminalId);
  return record && record.pty !== null;
}

export function activateTerminal(terminalId, pty, ws) {
  const record = terminals.get(terminalId);
  if (!record) return null;

  record.pty = pty;
  record.ws = ws;
  record.status = 'active';
  record.pid = pty.pid;
  record.activatedAt = new Date().toISOString();
  record.output = '';

  pty.onData((data) => {
    const r = terminals.get(terminalId);
    if (r) {
      r.output += data;
      if (r.ws && r.ws.readyState === r.ws.OPEN) {
        r.ws.send(JSON.stringify({ type: 'data', data }));
      }
    }
  });

  pty.onExit(({ exitCode, signal }) => {
    console.log(`[procesos_consola] terminal ${terminalId}: terminada (pid ${pty.pid}), código: ${exitCode}, señal: ${signal}`);
    const r = terminals.get(terminalId);
    if (r && r.ws && r.ws.readyState === r.ws.OPEN) {
      r.ws.send(JSON.stringify({ type: 'exit', code: exitCode, signal, output: r.output || '' }));
      r.ws.close();
    }
    closeTerminal(terminalId);
  });

  memoriaClient.set('procesos_consola', `terminal:${terminalId}`, {
    terminalId,
    chatSessionId: record.chatSessionId,
    cwd: record.cwd,
    cmd: record.cmd,
    pid: pty.pid,
    createdAt: record.createdAt,
    activatedAt: record.activatedAt,
    status: 'active',
  }).catch(err => console.log('[procesos_consola] Error al actualizar terminal en memoria:', err.message));

  return record;
}

export function attachWebSocket(terminalId, ws) {
  const record = terminals.get(terminalId);
  if (!record) return false;

  record.ws = ws;
  if (record.status === 'pending' && record.pty) {
    record.status = 'active';
  }

  console.log(`[procesos_consola] terminal ${terminalId}: WebSocket reconectado`);
  return true;
}

export function detachWebSocket(terminalId) {
  const record = terminals.get(terminalId);
  if (!record) return;

  record.ws = null;
  console.log(`[procesos_consola] terminal ${terminalId}: WebSocket desconectado, PTY sigue activo`);
}

export function getTerminal(terminalId) {
  return terminals.get(terminalId) || null;
}

export function listTerminals(chatSessionId) {
  if (chatSessionId !== undefined && chatSessionId !== null) {
    const sid = String(chatSessionId);
    return Array.from(terminals.values()).filter(
      (t) => String(t.chatSessionId) === sid
    );
  }
  return Array.from(terminals.values());
}

export async function closeTerminal(terminalId) {
  const record = terminals.get(terminalId);
  if (!record) {
    console.log(`[procesos_consola] closeTerminal(${terminalId}): no encontrado (by: ${new Error().stack?.split('\n')[2]?.trim() || '?'})`);
    return null;
  }
  console.log(`[procesos_consola] closeTerminal(${terminalId}): cerrando (by: ${new Error().stack?.split('\n')[2]?.trim() || '?'})`);

  if (record.ws) {
    try { record.ws.close(); } catch (err) { console.log('[procesos_consola] Error al cerrar WS:', err.message); }
    record.ws = null;
  }
  if (record.pty) {
    try { record.pty.kill(); } catch (err) { console.log('[procesos_consola] Error al matar PTY:', err.message); }
    record.pty = null;
  }

  record.status = 'closed';
  terminals.delete(terminalId);

  memoriaClient.del('procesos_consola', `terminal:${terminalId}`).catch(err => console.log('[procesos_consola] Error al eliminar terminal de memoria:', err.message));
  if (record.chatSessionId) {
    updateChatIndex(record.chatSessionId, terminalId, 'remove').catch(err => console.log('[procesos_consola] Error al actualizar índice de chat_terminals:', err.message));
  }

  return record;
}

export async function closeTerminalsBySession(chatSessionId) {
  const sid = String(chatSessionId);
  const ids = Array.from(terminals.keys()).filter(
    (id) => String(terminals.get(id).chatSessionId) === sid
  );
  const results = [];
  for (const id of ids) {
    const r = await closeTerminal(id);
    if (r) results.push(r);
  }
  return results;
}

async function updateChatIndex(chatSessionId, terminalId, action) {
  const key = `chat_terminals:${chatSessionId}`;
  try {
    const result = await memoriaClient.get('procesos_consola', key);
    let list = (result && result.value && Array.isArray(result.value)) ? result.value : [];
    if (action === 'add') {
      if (!list.includes(terminalId)) list.push(terminalId);
    } else if (action === 'remove') {
      list = list.filter((id) => id !== terminalId);
    }
    await memoriaClient.set('procesos_consola', key, list);
  } catch (err) {
    console.log('[memoria] error actualizando índice de chat_terminals:', err.message);
  }
}
