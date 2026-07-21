import { execSync, spawn } from 'child_process';
import path from 'path';
import { fileURLToPath } from 'url';
import express from 'express';
import authMiddleware from './authMiddleware.js';
import gestorRoutes from './routes/gestor.routes.js';
import servicesRoutes from './routes/services.routes.js';

const PORT = process.env.SERVICIO_GESTOR_PORT;
if (!PORT) {
  console.log('SERVICIO_GESTOR_PORT no está definido en .env');
  process.exit(1);
}

const __dirname = path.dirname(fileURLToPath(import.meta.url));

const processes = {};

const serviceConfig = {
  memoria: {
    script: '../../api_memoria/src/index.js',
    cwd: path.resolve(__dirname, '../../api_memoria'),
    port: process.env.SERVICIO_MEMORIA_PORT,
  },
  backend: {
    script: '../../backend/src/index.js',
    cwd: path.resolve(__dirname, '../../backend'),
    port: process.env.PORT,
  },
  frontend: {
    script: '../../frontend/node_modules/.bin/vite',
    cwd: path.resolve(__dirname, '../../frontend'),
    port: process.env.SERVICIO_FRONTEND_PORT || 5173,
    env: { VITE_DISABLE_HMR: 'true' },
  },
  playwright: {
    script: '../../playwright/src/index.js',
    cwd: path.resolve(__dirname, '../../playwright'),
    port: process.env.SERVICIO_PLAYWRIGHT_PORT,
  },
  documental: {
    script: '../../api_documental/src/index.js',
    cwd: path.resolve(__dirname, '../../api_documental'),
    port: process.env.SERVICIO_DOCUMENTAL_PORT,
  },
  gastos: {
    script: '../../api_gastos/src/index.js',
    cwd: path.resolve(__dirname, '../../api_gastos'),
    port: process.env.SERVICIO_GASTOS_PORT,
  },
  procesos_consola: {
    script: '../../api_procesos_consola/src/index.js',
    cwd: path.resolve(__dirname, '../../api_procesos_consola'),
    port: process.env.SERVICIO_PROCESOS_CONSOLA_PORT,
  },
};

export function getProcess(name) {
  return processes[name] || null;
}

export function isRunning(name) {
  const proc = processes[name];
  return !!proc && !proc.killed;
}

export function getServiceConfig() {
  return serviceConfig;
}

function spawnService(name, logTag) {
  const config = serviceConfig[name];
  if (!config) {
    console.log(`[gestor] servicio desconocido: ${name}`);
    return null;
  }

  const scriptPath = path.resolve(__dirname, config.script);
  const args = [scriptPath, ...(config.args || [])];
  const proc = spawn('node', args, {
    cwd: config.cwd,
    stdio: ['ignore', 'pipe', 'pipe'],
    env: { ...process.env, ...(config.env || {}) },
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
    if (processes[name] === proc) {
      processes[name] = null;
    }
  });

  proc.on('error', (err) => {
    console.log(`[${logTag}] error al iniciar:`, err.message);
    if (processes[name] === proc) {
      processes[name] = null;
    }
  });

  processes[name] = proc;
  return proc;
}

export function restartService(name) {
  const current = processes[name];
  if (current && !current.killed) {
    current.kill('SIGTERM');
    processes[name] = null;
    try {
      execSync(`sleep 2`, { stdio: 'ignore', timeout: 5000 });
      current.kill('SIGKILL');
    } catch (err) {
      if (err.code !== 'ESRCH') {
        console.log('[gestor] Error al forzar cierre de', name, 'en restart:', err.message);
      }
    }
  }
  return spawnService(name, name);
}

function startAllServices() {
  for (const name of Object.keys(serviceConfig)) {
    spawnService(name, name);
  }
}

function killPort(port) {
  try {
    execSync(`fuser -k -TERM ${port}/tcp 2>/dev/null`, { stdio: 'ignore', timeout: 5000 });
    execSync(`sleep 2`, { stdio: 'ignore', timeout: 5000 });
    execSync(`fuser -k -KILL ${port}/tcp 2>/dev/null || lsof -ti :${port} | xargs kill -9 2>/dev/null || true`, { stdio: 'ignore', timeout: 5000 });
    execSync(`sleep 1`, { stdio: 'ignore', timeout: 5000 });
    const remain = execSync(`fuser ${port}/tcp 2>/dev/null || lsof -ti :${port} 2>/dev/null || true`, { encoding: 'utf8', timeout: 5000 }).toString().trim();
    if (remain) {
      console.log('[gestor] AVISO: Puerto', port, 'aún ocupado por:', remain);
    }
  } catch (err) {
    console.log('[gestor] Error al cerrar puerto', port, ':', err.message);
  }
}

function cleanup() {
  const targets = [];
  for (const name of Object.keys(processes)) {
    const proc = processes[name];
    if (proc && !proc.killed) {
      targets.push(proc);
      proc.kill('SIGTERM');
    }
  }
  try {
    execSync(`sleep 2`, { stdio: 'ignore', timeout: 5000 });
  } catch (e) { console.log('[gestor] Error en pausa durante cleanup:', e.message); }
  for (const proc of targets) {
    try {
      proc.kill('SIGKILL');
    } catch (err) {
      if (err.code !== 'ESRCH') {
        console.log('[gestor] Error al forzar cierre:', err.message);
      }
    }
  }
}

function start() {
  const ports = [
    PORT,
    ...Object.values(serviceConfig).map(c => c.port),
    process.env.OPENCODE_PORT,
  ].filter(Boolean);

  for (const p of ports) {
    killPort(p);
  }

  const app = express();
  app.use(express.json({ limit: '200mb' }));
  app.use('/api/gestor', authMiddleware, gestorRoutes);
  app.use('/api/gestor', authMiddleware, servicesRoutes);

  const server = app.listen(PORT, (err) => {
    if (err) {
      console.log('Error al iniciar servidor gestor:', err.message);
      process.exit(1);
    }
    console.log(`Gestor de servicios listening on port ${PORT}`);

    startAllServices();
  });
}

start();

process.on('uncaughtException', (err, origin) => {
  console.log('[gestor] UNCAUGHT EXCEPTION:', err.message, '\n', err.stack, '\norigin:', origin);
});

process.on('unhandledRejection', (reason, promise) => {
  console.log('[gestor] UNHANDLED REJECTION:', reason instanceof Error ? reason.message : reason, '\n', reason instanceof Error ? reason.stack : '');
});

process.on('exit', cleanup);
process.on('SIGTERM', () => {
  cleanup();
  process.exit(0);
});
process.on('SIGINT', () => {
  cleanup();
  process.exit(0);
});
