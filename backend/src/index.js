import 'dotenv/config';
import http from 'http';
import { spawn, execSync } from 'child_process';
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
import funcionalidadRoutes from './routes/funcionalidad.routes.js';
import proyectoRoutes from './routes/proyecto.routes.js';
import documentacionRoutes from './routes/documentacion.routes.js';
import gastosRoutes from './routes/gastos.routes.js';
import redmineRoutes from './routes/redmine.routes.js';
import ticketsRoutes from './routes/tickets.routes.js';
import workspacesRoutes from './routes/workspaces.routes.js';
import despliegueRoutes from './routes/despliegue.routes.js';
import templatesRoutes from './routes/templates.routes.js';
import environmentsRoutes from './routes/environments.routes.js';
import playwrightLogsRoutes from './routes/playwrightLogs.routes.js';
import stateRoutes from './routes/state.routes.js';
import opencode from './services/opencode.js';
import * as devInstanceManager from './services/devInstanceManager.js';
import db from './config/db.js';

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
app.use('/api', funcionalidadRoutes);
app.use('/api', proyectoRoutes);
app.use('/api/documentacion', documentacionRoutes);
app.use('/api/gastos', gastosRoutes);
app.use('/api/redmine', redmineRoutes);
app.use('/api/tickets', ticketsRoutes);
app.use('/api/workspaces', workspacesRoutes);
app.use('/api/despliegue', despliegueRoutes);
app.use('/api/templates', templatesRoutes);
app.use('/api/environments', environmentsRoutes);
app.use('/api/playwright-logs', playwrightLogsRoutes);
app.use('/api/state', stateRoutes);

let pwProcess = null;
let docProcess = null;
let gastosProcess = null;

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

function startDocumentalService() {
  const docPort = process.env.SERVICIO_DOCUMENTAL_PORT || 4099;
  const __dirname = path.dirname(fileURLToPath(import.meta.url));
  const docPath = path.resolve(__dirname, '../../api_documental/src/index.js');
  docProcess = spawn('node', [docPath], {
    stdio: ['ignore', 'pipe', 'pipe'],
    env: { ...process.env },
  });

  docProcess.stdout.on('data', (data) => {
    const text = data.toString().trim();
    if (text) console.log('[documental]', text);
  });

  docProcess.stderr.on('data', (data) => {
    const text = data.toString().trim();
    if (text) console.log('[documental]', text);
  });

  docProcess.on('exit', (code) => {
    console.log('[documental] proceso terminado, código:', code);
    docProcess = null;
  });

  docProcess.on('error', (err) => {
    console.log('[documental] error al iniciar:', err.message);
    docProcess = null;
  });
}

function startGastosService() {
  const gastosPort = process.env.SERVICIO_GASTOS_PORT || 4100;
  const __dirname = path.dirname(fileURLToPath(import.meta.url));
  const gastosPath = path.resolve(__dirname, '../../api_gastos/src/index.js');
  gastosProcess = spawn('node', [gastosPath], {
    stdio: ['ignore', 'pipe', 'pipe'],
    env: { ...process.env },
  });

  gastosProcess.stdout.on('data', (data) => {
    const text = data.toString().trim();
    if (text) console.log('[gastos]', text);
  });

  gastosProcess.stderr.on('data', (data) => {
    const text = data.toString().trim();
    if (text) console.log('[gastos]', text);
  });

  gastosProcess.on('exit', (code) => {
    console.log('[gastos] proceso terminado, código:', code);
    gastosProcess = null;
  });

  gastosProcess.on('error', (err) => {
    console.log('[gastos] error al iniciar:', err.message);
    gastosProcess = null;
  });
}

function killPort(port) {
  try {
    execSync(`fuser -k ${port}/tcp 2>/dev/null || lsof -ti :${port} | xargs kill -9 2>/dev/null`, { stdio: 'ignore' });
  } catch {
  }
}

async function start() {
  const ports = [process.env.PORT, process.env.SERVICIO_PLAYWRIGHT_PORT, process.env.SERVICIO_DOCUMENTAL_PORT, process.env.SERVICIO_GASTOS_PORT, process.env.OPENCODE_PORT].filter(Boolean);
  for (const p of ports) {
    killPort(p);
  }

  try {
    console.log('[migrate] Ejecutando migraciones pendientes...');
    await db.migrate.latest();
    console.log('[migrate] Migraciones ejecutadas correctamente.');
  } catch (err) {
    console.log('[migrate] Error al ejecutar migraciones:', err.message);
    process.exit(1);
  }

  const server = http.createServer(app);
  server.listen(PORT, (err) => {
    if (err) {
      console.log('Error al iniciar servidor:', err.message);
      process.exit(1);
    }
    console.log(`Server listening on port ${PORT}`);
    startPlaywrightService();
    startDocumentalService();
    startGastosService();
  });
}

start();

process.on('exit', () => {
  devInstanceManager.stopAll();
  opencode.stopAllServers();
  if (pwProcess) pwProcess.kill();
  if (docProcess) docProcess.kill();
  if (gastosProcess) gastosProcess.kill();
});
process.on('SIGTERM', () => {
  devInstanceManager.stopAll();
  opencode.stopAllServers();
  if (pwProcess) pwProcess.kill();
  if (docProcess) docProcess.kill();
  if (gastosProcess) gastosProcess.kill();
  process.exit(0);
});
process.on('SIGINT', () => {
  devInstanceManager.stopAll();
  opencode.stopAllServers();
  if (pwProcess) pwProcess.kill();
  if (docProcess) docProcess.kill();
  if (gastosProcess) gastosProcess.kill();
  process.exit(0);
});
