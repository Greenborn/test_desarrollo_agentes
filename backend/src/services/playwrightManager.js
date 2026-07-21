import { spawn, execSync } from 'child_process';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const PLAYWRIGHT_DIR = path.resolve(__dirname, '../../../playwright');
const PLAYWRIGHT_PORT = process.env.SERVICIO_PLAYWRIGHT_PORT || 4098;

let proc = null;
let ready = false;
let keepAliveInterval = null;

function baseUrl() {
  return `http://localhost:${PLAYWRIGHT_PORT}`;
}

async function isRunning() {
  try {
    const res = await fetch(`${baseUrl()}/api/health`, { signal: AbortSignal.timeout(2000) });
    return res.ok;
  } catch (err) { console.log('[playwrightManager] Error en health check:', err.message); return false; }
}

function start() {
  return new Promise((resolve, reject) => {
    if (proc) {
      resolve();
      return;
    }

    proc = spawn('node', ['src/index.js'], {
      stdio: ['ignore', 'pipe', 'pipe'],
      env: { ...process.env, SERVICIO_PLAYWRIGHT_PORT: String(PLAYWRIGHT_PORT) },
      cwd: PLAYWRIGHT_DIR,
    });

    const timeout = setTimeout(() => {
      reject(new Error('Timeout esperando que el servicio Playwright inicie'));
    }, 15000);

    const onData = (data) => {
      const text = data.toString().trim();
      console.log('[playwright]', text);
      if (text.includes('listening') || text.includes('Listening')) {
        ready = true;
        clearTimeout(timeout);
        resolve();
      }
    };

    proc.stdout.on('data', onData);
    proc.stderr.on('data', onData);

    proc.on('exit', (code) => {
      console.log('[playwright] proceso terminado, código:', code);
      proc = null;
      ready = false;
      clearTimeout(timeout);
    });

    proc.on('error', (err) => {
      console.log('[playwright] error al iniciar:', err.message);
      proc = null;
      ready = false;
      clearTimeout(timeout);
      reject(err);
    });
  });
}

async function ensureRunning() {
  if (await isRunning()) return;
  console.log('[playwright] servicio no está corriendo, iniciándolo...');
  await start();
  const started = Date.now();
  while (Date.now() - started < 15000) {
    if (await isRunning()) {
      ready = true;
      console.log('[playwright] servicio listo');
      return;
    }
    await new Promise((r) => setTimeout(r, 300));
  }
  throw new Error('No se pudo iniciar el servicio Playwright');
}

function stop() {
  if (keepAliveInterval) {
    clearInterval(keepAliveInterval);
    keepAliveInterval = null;
  }
  if (proc) {
    proc.kill('SIGTERM');
    try {
      execSync(`sleep 2`, { stdio: 'ignore', timeout: 5000 });
    } catch (e) { console.log('[playwright] Error en pausa después de SIGTERM:', e.message); }
    try {
      proc.kill('SIGKILL');
    } catch (err) {
      if (err.code !== 'ESRCH') {
        console.log('[playwright] Error al forzar cierre:', err.message);
      }
    }
    proc = null;
    ready = false;
  }
}

function startKeepAlive() {
  if (keepAliveInterval) return;
  keepAliveInterval = setInterval(async () => {
    if (!await isRunning()) {
      if (proc) {
        console.log('[playwright] keep-alive: servicio caído, reiniciando...');
      }
      try {
        await ensureRunning();
      } catch (err) {
        console.log('[playwright] keep-alive: error al reiniciar:', err.message);
      }
    }
  }, 10000);
}

export default {
  ensureRunning,
  stop,
  startKeepAlive,
  isRunning,
  baseUrl,
};
