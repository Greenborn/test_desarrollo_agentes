import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';
import { execSync } from 'child_process';
import http from 'http';
import express from 'express';
import { WebSocketServer } from 'ws';
import procesosRoutes from './routes/procesos.routes.js';
import { handleConnection } from './services/wsHandler.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

dotenv.config({ path: path.resolve(__dirname, '../../backend/.env') });

const PORT = process.env.SERVICIO_PROCESOS_CONSOLA_PORT;
if (!PORT) {
  console.log('SERVICIO_PROCESOS_CONSOLA_PORT no está definido en .env');
  process.exit(1);
}

const API_KEY = process.env.PROCESOS_CONSOLA_API_KEY;

function authMiddleware(req, res, next) {
  if (req.path === '/health') return next();

  const token = req.headers['authorization']?.replace(/^Bearer\s+/i, '')
    || req.headers['x-api-key']
    || req.query.api_key;

  if (!token || token !== API_KEY) {
    return res.status(401).json({ error: 'API key inválida' });
  }
  next();
}

function killPort(port) {
  try {
    execSync(`fuser -k -TERM ${port}/tcp 2>/dev/null`, { stdio: 'ignore', timeout: 5000 });
    execSync(`sleep 2`, { stdio: 'ignore', timeout: 5000 });
    execSync(`fuser -k -KILL ${port}/tcp 2>/dev/null || lsof -ti :${port} | xargs kill -9 2>/dev/null || true`, { stdio: 'ignore', timeout: 5000 });
    execSync(`sleep 1`, { stdio: 'ignore', timeout: 5000 });
    const remain = execSync(`fuser ${port}/tcp 2>/dev/null || lsof -ti :${port} 2>/dev/null || true`, { encoding: 'utf8', timeout: 5000 }).toString().trim();
    if (remain) {
      console.log('[procesos_consola] AVISO: Puerto', port, 'aún ocupado por:', remain);
    }
  } catch (err) {
    console.log('[procesos_consola] Error al cerrar puerto', port, ':', err.message);
  }
}

killPort(PORT);

const app = express();
app.use(express.json({ limit: '200mb' }));
app.use('/api', authMiddleware, procesosRoutes);

process.on('uncaughtException', (err, origin) => {
  console.log('[procesos_consola] UNCAUGHT EXCEPTION:', err.message, '\n', err.stack, '\norigin:', origin);
});

process.on('unhandledRejection', (reason, promise) => {
  console.log('[procesos_consola] UNHANDLED REJECTION:', reason instanceof Error ? reason.message : reason, '\n', reason instanceof Error ? reason.stack : '');
});

process.on('SIGTERM', () => {
  console.log('[procesos_consola] Recibido SIGTERM, cerrando terminals...');
  process.exit(0);
});

const server = http.createServer(app);

const wss = new WebSocketServer({ server });

wss.on('connection', (ws, req) => {
  const url = new URL(req.url, `http://${req.headers.host || 'localhost'}`);
  const terminalId = url.searchParams.get('terminalId');

  if (!terminalId) {
    ws.send(JSON.stringify({ type: 'error', message: 'terminalId es requerido' }));
    ws.close();
    return;
  }

  handleConnection(ws, req, terminalId);
});

server.listen(PORT, (err) => {
  if (err) {
    console.log('Error al iniciar api_procesos_consola:', err.message);
    process.exit(1);
  }
  console.log(`[procesos_consola] Servicio listening on port ${PORT}`);
});
