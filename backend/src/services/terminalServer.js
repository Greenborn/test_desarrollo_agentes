import http from 'http';
import { WebSocketServer } from 'ws';
import { spawn } from 'node-pty';

const PORT = process.env.SERVICIO_TERMINAL_PORT || 4201;

export function setupTerminalServer() {
  const server = http.createServer();
  const wss = new WebSocketServer({ server });

  wss.on('connection', (ws, req) => {
    console.log(`[terminal:${PORT}] cliente conectado`);

    const url = new URL(req.url, `http://${req.headers.host || 'localhost'}`);
    const paramCwd = url.searchParams.get('cwd');
    const paramCmd = url.searchParams.get('cmd');

    const shell = process.env.SHELL || 'bash';
    const cwd = paramCwd || process.env.CWD || process.cwd();
    const args = paramCmd ? ['-c', paramCmd] : [];

    const pty = spawn(shell, args, {
      name: 'xterm-256color',
      cols: 80,
      rows: 24,
      cwd,
      env: { ...process.env, TERM: 'xterm-256color' },
    });

    console.log(`[terminal:${PORT}] shell iniciada: ${shell} (pid ${pty.pid}) en: ${cwd}`);

    pty.onData((data) => {
      if (ws.readyState === ws.OPEN) {
        ws.send(JSON.stringify({ type: 'data', data }));
      }
    });

    pty.onExit(({ exitCode, signal }) => {
      console.log(`[terminal:${PORT}] shell terminada (pid ${pty.pid}), código: ${exitCode}, señal: ${signal}`);
      if (ws.readyState === ws.OPEN) {
        ws.send(JSON.stringify({ type: 'exit', code: exitCode, signal }));
        ws.close();
      }
    });

    ws.on('message', (raw) => {
      let msg;
      try {
        msg = JSON.parse(raw);
      } catch {
        return;
      }

      if (msg.type === 'input') {
        pty.write(msg.data);
      } else if (msg.type === 'resize') {
        try {
          pty.resize(msg.cols, msg.rows);
        } catch (resizeErr) {
          console.log(`[terminal:${PORT}] error al redimensionar:`, resizeErr.message);
        }
      }
    });

    ws.on('close', () => {
      console.log(`[terminal:${PORT}] cliente desconectado`);
      try { pty.kill(); } catch {}
    });

    ws.on('error', (err) => {
      console.log(`[terminal:${PORT}] error en conexión:`, err.message);
      try { pty.kill(); } catch {}
    });
  });

  server.listen(PORT, () => {
    console.log(`[terminal] WebSocket server listening on port ${PORT}`);
  });
}
