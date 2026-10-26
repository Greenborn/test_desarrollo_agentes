import { spawn } from 'node-pty';

// Terminal remota simulada: crea PTYs reales (node-pty) en el proceso del backend y
// transmite su I/O por socket.io hacia la gestión interna. Permite replicar desde la
// interfaz remota (SGI) la usabilidad de `/terminal` del frontend local.
//
// El streaming se hace con eventos socket.io SIN ack (data/exit); el ciclo de vida
// (create/input/resize/close/list) usa pseudoendpoints request/response con ack.

const terminals = new Map();
const bySession = new Map();

let idCounter = 0;

function genId() {
  idCounter += 1;
  return `rt-${Date.now().toString(36)}-${idCounter}-${Math.random().toString(36).slice(2, 6)}`;
}

export function createRemoteTerminal({ chatSessionId, cwd = null, cmd = null, emit = null } = {}) {
  if (!chatSessionId) {
    return { success: false, error: 'chatSessionId requerido' };
  }

  const terminalId = genId();
  const shell = process.env.SHELL || 'bash';
  const cmdText = cmd && typeof cmd === 'string' ? cmd.trim() : '';
  const args = cmdText ? ['-c', cmdText] : [];
  const ptyOpts = {
    name: 'xterm-256color',
    cols: 80,
    rows: 24,
    env: { ...process.env, TERM: 'xterm-256color' },
  };
  if (cwd && typeof cwd === 'string') ptyOpts.cwd = cwd;

  let pty;
  try {
    pty = spawn(shell, args, ptyOpts);
  } catch (err) {
    console.log('[remoteTerminal] Error al iniciar PTY:', err.message);
    return { success: false, error: `No se pudo iniciar la terminal: ${err.message}` };
  }

  const record = {
    terminalId,
    chatSessionId,
    cwd: cwd && typeof cwd === 'string' ? cwd : null,
    cmd: cmdText || null,
    pty,
    pid: pty.pid || null,
    createdAt: new Date().toISOString(),
    output: '',
    exited: false,
  };

  terminals.set(terminalId, record);
  if (!bySession.has(chatSessionId)) {
    bySession.set(chatSessionId, new Set());
  }
  bySession.get(chatSessionId).add(terminalId);

  pty.onData((data) => {
    record.output += data;
    if (record.output.length > 50000) {
      record.output = record.output.slice(record.output.length - 50000);
    }
    const payload = { chatSessionId, terminalId, data };
    if (typeof emit === 'function') {
      emit('interfaz-remota:terminal:data', payload);
    } else {
      console.log('[remoteTerminal] data (sin emisor SGI):', data.slice(0, 80));
    }
  });

  pty.onExit(({ exitCode, signal }) => {
    record.exited = true;
    const payload = { chatSessionId, terminalId, code: exitCode, signal, output: record.output };
    if (typeof emit === 'function') {
      emit('interfaz-remota:terminal:exit', payload);
    } else {
      console.log('[remoteTerminal] exit (sin emisor SGI): code=', exitCode);
    }
    terminals.delete(terminalId);
    const set = bySession.get(chatSessionId);
    if (set) set.delete(terminalId);
  });

  console.log(`[remoteTerminal] terminal creada: ${terminalId} (sesión ${chatSessionId}, pid ${record.pid})`);
  return { success: true, data: { terminalId } };
}

export function writeRemoteTerminal({ terminalId = null, data = null } = {}) {
  if (!terminalId) return { success: false, error: 'terminalId requerido' };
  if (data === null || data === undefined) return { success: false, error: 'data requerido' };
  const r = terminals.get(terminalId);
  if (!r) return { success: false, error: 'Terminal no encontrada' };
  if (r.exited) return { success: false, error: 'Terminal finalizada' };
  try {
    r.pty.write(data);
  } catch (err) {
    console.log('[remoteTerminal] Error al escribir en PTY:', err.message);
    return { success: false, error: `Error al escribir en la terminal: ${err.message}` };
  }
  return { success: true };
}

export function resizeRemoteTerminal({ terminalId = null, cols = null, rows = null } = {}) {
  if (!terminalId) return { success: false, error: 'terminalId requerido' };
  const c = parseInt(cols, 10);
  const rn = parseInt(rows, 10);
  if (!c || !rn || c < 1 || rn < 1) return { success: false, error: 'cols y rows deben ser enteros positivos' };
  const r = terminals.get(terminalId);
  if (!r) return { success: false, error: 'Terminal no encontrada' };
  if (r.exited) return { success: false, error: 'Terminal finalizada' };
  try {
    r.pty.resize(c, rn);
  } catch (err) {
    console.log('[remoteTerminal] Error al redimensionar PTY:', err.message);
    return { success: false, error: `Error al redimensionar la terminal: ${err.message}` };
  }
  return { success: true };
}

export function closeRemoteTerminal({ terminalId = null } = {}) {
  if (!terminalId) return { success: false, error: 'terminalId requerido' };
  const r = terminals.get(terminalId);
  if (!r) return { success: false, error: 'Terminal no encontrada' };
  if (r.exited) return { success: false, error: 'Terminal finalizada' };
  try {
    r.pty.kill();
  } catch (err) {
    console.log('[remoteTerminal] Error al cerrar PTY:', err.message);
  }
  terminals.delete(terminalId);
  const set = bySession.get(r.chatSessionId);
  if (set) set.delete(terminalId);
  console.log(`[remoteTerminal] terminal cerrada: ${terminalId}`);
  return { success: true };
}

export function listRemoteTerminals({ chatSessionId = null } = {}) {
  const ids = (chatSessionId && bySession.get(chatSessionId)) || new Set();
  const list = [];
  for (const id of ids) {
    const r = terminals.get(id);
    if (r) {
      list.push({
        terminalId: r.terminalId,
        chatSessionId: r.chatSessionId,
        cwd: r.cwd,
        cmd: r.cmd,
        pid: r.pid,
        createdAt: r.createdAt,
      });
    }
  }
  return { success: true, data: { terminals: list } };
}

export function stopAllRemoteTerminals() {
  for (const r of terminals.values()) {
    try {
      r.pty.kill();
    } catch (err) {
      console.log('[remoteTerminal] Error al detener PTY:', err.message);
    }
  }
  terminals.clear();
  bySession.clear();
  console.log('[remoteTerminal] todas las terminales detenidas');
}
