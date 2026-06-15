import 'dotenv/config';
import http from 'http';
import { spawn } from 'child_process';
import { fileURLToPath } from 'url';
import path from 'path';
import express from 'express';
import sessionMiddleware from './middlewares/sessionAuth.js';
import authRoutes from './routes/auth.routes.js';
import chatRoutes from './routes/chat.routes.js';
import settingsRoutes from './routes/settings.routes.js';
import commandRoutes from './routes/command.routes.js';
import opencodeRoutes from './routes/opencode.routes.js';
import navegadorRoutes from './routes/navegador.routes.js';
import opencode from './services/opencode.js';

const PORT = process.env.PORT;
if (!PORT) {
  console.log('PORT no está definido en .env');
  process.exit(1);
}

const app = express();
app.use(sessionMiddleware);
app.use(express.json());

app.use('/api/auth', authRoutes);
app.use('/api/chat', chatRoutes);
app.use('/api/settings', settingsRoutes);
app.use('/api/command', commandRoutes);
app.use('/api/opencode', opencodeRoutes);
app.use('/api/navegador', navegadorRoutes);

let pwProcess = null;

function startPlaywrightService() {
  const pwPort = process.env.SERVICIO_PLAYWRIGHT_PORT || 4098;
  const __dirname = path.dirname(fileURLToPath(import.meta.url));
  const pwPath = path.resolve(__dirname, '../../playwright/src/index.js');
  pwProcess = spawn('node', [pwPath], {
    stdio: ['ignore', 'pipe', 'pipe'],
    env: { ...process.env },
  });

  pwProcess.stdout.on('data', (data) => {
    const text = data.toString().trim();
    if (text) console.log('[playwright]', text);
  });

  pwProcess.stderr.on('data', (data) => {
    const text = data.toString().trim();
    if (text) console.log('[playwright]', text);
  });

  pwProcess.on('exit', (code) => {
    console.log('[playwright] proceso terminado, código:', code);
    pwProcess = null;
  });

  pwProcess.on('error', (err) => {
    console.log('[playwright] error al iniciar:', err.message);
    pwProcess = null;
  });
}

const server = http.createServer(app);
server.listen(PORT, (err) => {
  if (err) {
    console.log('Error al iniciar servidor:', err.message);
    process.exit(1);
  }
  console.log(`Server listening on port ${PORT}`);
  startPlaywrightService();
});

process.on('exit', () => {
  opencode.stopAllServers();
  if (pwProcess) pwProcess.kill();
});
process.on('SIGTERM', () => {
  opencode.stopAllServers();
  if (pwProcess) pwProcess.kill();
  process.exit(0);
});
process.on('SIGINT', () => {
  opencode.stopAllServers();
  if (pwProcess) pwProcess.kill();
  process.exit(0);
});
