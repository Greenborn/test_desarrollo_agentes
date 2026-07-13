import { execSync } from 'child_process';
import http from 'http';
import express from 'express';
import { WebSocketServer } from 'ws';
import authMiddleware from './authMiddleware.js';
import memoriaRoutes from './routes/memoria.routes.js';
import setupWebSocket from './wsHandler.js';

const PORT = process.env.SERVICIO_MEMORIA_PORT;
if (!PORT) {
  console.log('SERVICIO_MEMORIA_PORT no está definido en .env');
  process.exit(1);
}

const app = express();
app.use(express.json({ limit: '200mb' }));
app.use('/api/memoria', authMiddleware, memoriaRoutes);

function killPort(port) {
  try {
    execSync(`fuser -k ${port}/tcp 2>/dev/null || lsof -ti :${port} | xargs kill -9 2>/dev/null`, { stdio: 'ignore' });
  } catch (err) {
    console.log('[memoria] Error al matar puerto:', err.message);
  }
}
killPort(PORT);

const server = http.createServer(app);

const wss = new WebSocketServer({ server, path: '/api/memoria' });
setupWebSocket(wss);

server.listen(PORT, (err) => {
  if (err) {
    console.log('Error al iniciar servidor memoria:', err.message);
    process.exit(1);
  }
  console.log(`Memoria service listening on port ${PORT} (HTTP + WebSocket)`);
});
