import { spawn } from 'node-pty';
import * as terminalManager from './terminalManager.js';

export function handleConnection(ws, req, terminalId) {
  const record = terminalManager.getTerminal(terminalId);
  if (!record) {
    ws.send(JSON.stringify({ type: 'error', message: 'terminal no encontrado' }));
    ws.close();
    return;
  }

  if (terminalManager.hasActivePty(terminalId)) {
    terminalManager.attachWebSocket(terminalId, ws);
  } else {
    const shell = process.env.SHELL || 'bash';
    const args = record.cmd ? ['-c', record.cmd] : [];

    const pty = spawn(shell, args, {
      name: 'xterm-256color',
      cols: 80,
      rows: 24,
      cwd: record.cwd,
      env: { ...process.env, TERM: 'xterm-256color' },
    });

    console.log(`[procesos_consola] terminal ${terminalId}: shell iniciada ${shell} (pid ${pty.pid}) en: ${record.cwd}`);
    terminalManager.activateTerminal(terminalId, pty, ws);
  }

  ws.on('message', (raw) => {
    let msg;
    try {
      msg = JSON.parse(raw);
    } catch (err) {
      console.log('[procesos_consola] Error al parsear mensaje WS:', err.message);
      return;
    }

    const r = terminalManager.getTerminal(terminalId);
    if (!r || !r.pty) return;

    if (msg.type === 'input') {
      r.pty.write(msg.data);
    } else if (msg.type === 'resize') {
      try {
        r.pty.resize(msg.cols, msg.rows);
      } catch (resizeErr) {
        console.log(`[procesos_consola] terminal ${terminalId}: error al redimensionar:`, resizeErr.message);
      }
    }
  });

  ws.on('close', () => {
    terminalManager.detachWebSocket(terminalId);
  });

  ws.on('error', (err) => {
    console.log(`[procesos_consola] terminal ${terminalId}: error en conexión:`, err.message);
    terminalManager.detachWebSocket(terminalId);
  });

  ws.send(JSON.stringify({ type: 'created', terminalId }));
}
