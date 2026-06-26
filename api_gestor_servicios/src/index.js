import { execSync, spawn } from 'child_process';
import path from 'path';
import { fileURLToPath } from 'url';
import express from 'express';
import gestorRoutes from './routes/gestor.routes.js';

const PORT = process.env.SERVICIO_GESTOR_PORT;
if (!PORT) {
  console.log('SERVICIO_GESTOR_PORT no está definido en .env');
  process.exit(1);
}

const __dirname = path.dirname(fileURLToPath(import.meta.url));

let pwProcess = null;
let docProcess = null;
let gastosProcess = null;
let memProcess = null;
let backendProcess = null;

function spawnService(name, relativeScriptPath, logTag, cwd) {
  const scriptPath = path.resolve(__dirname, relativeScriptPath);
  const proc = spawn('node', [scriptPath], {
    cwd: cwd || undefined,
    stdio: ['ignore', 'pipe', 'pipe'],
    env: { ...process.env },
  });

  proc.stdout.on('data', (data) => {
    const text = data.toString().trim();
    if (text) console.log(`[${logTag}]`, text);
  });

  proc.stderr.on('data', (data) => {
    const text = data.toString().trim();
    if (text) console.log(`[${logTag}]`, text);
  });

  proc.on('exit', (code) => {
    console.log(`[${logTag}] proceso terminado, código:`, code);
  });

  proc.on('error', (err) => {
    console.log(`[${logTag}] error al iniciar:`, err.message);
  });

  return proc;
}

function startBackendService() {
  const cwd = path.resolve(__dirname, '../../backend');
  backendProcess = spawnService('backend', '../../backend/src/index.js', 'backend', cwd);
}

function startPlaywrightService() {
  const cwd = path.resolve(__dirname, '../../playwright');
  pwProcess = spawnService('playwright', '../../playwright/src/index.js', 'playwright', cwd);
}

function startDocumentalService() {
  const cwd = path.resolve(__dirname, '../../api_documental');
  docProcess = spawnService('documental', '../../api_documental/src/index.js', 'documental', cwd);
}

function startGastosService() {
  const cwd = path.resolve(__dirname, '../../api_gastos');
  gastosProcess = spawnService('gastos', '../../api_gastos/src/index.js', 'gastos', cwd);
}

function startMemoriaService() {
  const cwd = path.resolve(__dirname, '../../api_memoria');
  memProcess = spawnService('memoria', '../../api_memoria/src/index.js', 'memoria', cwd);
}

function killPort(port) {
  try {
    execSync(`fuser -k ${port}/tcp 2>/dev/null || lsof -ti :${port} | xargs kill -9 2>/dev/null`, { stdio: 'ignore' });
  } catch {
  }
}

function cleanup() {
  if (backendProcess) backendProcess.kill();
  if (pwProcess) pwProcess.kill();
  if (docProcess) docProcess.kill();
  if (gastosProcess) gastosProcess.kill();
  if (memProcess) memProcess.kill();
}

function start() {
  const ports = [
    PORT,
    process.env.SERVICIO_PLAYWRIGHT_PORT,
    process.env.SERVICIO_DOCUMENTAL_PORT,
    process.env.SERVICIO_GASTOS_PORT,
    process.env.SERVICIO_MEMORIA_PORT,
    process.env.PORT,
    process.env.OPENCODE_PORT,
  ].filter(Boolean);

  for (const p of ports) {
    killPort(p);
  }

  const app = express();
  app.use(express.json());
  app.use('/api/gestor', gestorRoutes);

  const server = app.listen(PORT, (err) => {
    if (err) {
      console.log('Error al iniciar servidor gestor:', err.message);
      process.exit(1);
    }
    console.log(`Gestor de servicios listening on port ${PORT}`);

    startBackendService();
    startPlaywrightService();
    startDocumentalService();
    startGastosService();
    startMemoriaService();
  });
}

start();

process.on('exit', cleanup);
process.on('SIGTERM', () => {
  cleanup();
  process.exit(0);
});
process.on('SIGINT', () => {
  cleanup();
  process.exit(0);
});
