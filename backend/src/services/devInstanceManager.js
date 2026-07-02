import { spawn, execSync } from 'child_process';
import path from 'path';
import fs from 'fs';
import { waitForPortsByPID } from './portDetector.js';

const sessions = new Map(); // sessionId → { instances: Map<cwd,entry>, browserSessions: [], frontendPorts: [], resolution }
const PW_URL = `http://localhost:${process.env.SERVICIO_PLAYWRIGHT_PORT || 4098}`;

function getOrCreateSession(sessionId) {
  sessionId = Number(sessionId);
  if (!sessions.has(sessionId)) {
    sessions.set(sessionId, {
      instances: new Map(),
      browserSessions: [],
      frontendPorts: [],
      resolution: null,
    });
  }
  return sessions.get(sessionId);
}

function getSubprojects(deployConfig) {
  const installEntries = deployConfig.install || [];
  const pm2Entries = deployConfig.pm2 || [];
  const buildEntries = deployConfig.build || [];

  const seen = new Set();
  const subprojects = [];

  for (const entry of installEntries) {
    if (!entry.cwd || seen.has(entry.cwd)) continue;
    seen.add(entry.cwd);

    let type = null;
    if (pm2Entries.some(p => p.cwd === entry.cwd)) type = 'backend';
    else if (buildEntries.some(b => b.cwd === entry.cwd)) type = 'frontend';

    if (type) subprojects.push({ cwd: entry.cwd, type });
  }

  return subprojects;
}

function runNpmCi(dir) {
  return new Promise((resolve, reject) => {
    const proc = spawn('npm', ['ci'], {
      cwd: dir,
      stdio: ['ignore', 'pipe', 'pipe'],
      env: { ...process.env },
    });

    proc.stdout.on('data', (data) => {
      const text = data.toString().trim();
      if (text) console.log(`[npm-ci:${path.basename(dir)}]`, text);
    });

    proc.stderr.on('data', (data) => {
      const text = data.toString().trim();
      if (text) console.log(`[npm-ci:${path.basename(dir)}]`, text);
    });

    proc.on('exit', (code) => {
      if (code === 0) resolve();
      else reject(new Error(`npm ci falló con código ${code}`));
    });

    proc.on('error', reject);
  });
}

async function detectInstancePort(entry) {
  const pid = entry.process && entry.process.pid;
  if (!pid) return;
  const port = await waitForPortsByPID(pid, 15000, 500);
  if (port && !entry.detectedPort) {
    entry.detectedPort = port;
    entry.detectedUrl = `http://localhost:${port}`;
  }
}

export async function startDevInstance(projectRoot, deployConfig, sessionId = null) {
  if (!sessionId) {
    throw new Error('Se requiere sessionId para iniciar una instancia de desarrollo.');
  }

  const session = getOrCreateSession(sessionId);
  const subprojects = getSubprojects(deployConfig);
  if (subprojects.length === 0) {
    return [];
  }

  const npmCiResults = await Promise.allSettled(
    subprojects.map(sub => runNpmCi(path.resolve(projectRoot, sub.cwd)))
  );

  const results = [];

  for (let i = 0; i < subprojects.length; i++) {
    const sub = subprojects[i];
    const fullPath = path.resolve(projectRoot, sub.cwd);

    if (!fs.existsSync(fullPath)) {
      results.push({ name: sub.cwd, type: sub.type, status: 'error', error: `Directorio no encontrado: ${fullPath}` });
      continue;
    }

    if (npmCiResults[i].status === 'rejected') {
      results.push({ name: sub.cwd, type: sub.type, status: 'error', error: 'npm ci falló. Revise los logs del servidor.' });
      continue;
    }

    let proc;
    if (sub.type === 'backend') {
      proc = spawn('npx', ['nodemon'], {
        cwd: fullPath,
        stdio: ['ignore', 'pipe', 'pipe'],
        env: { ...process.env },
        detached: true,
      });
    } else {
      proc = spawn('npm', ['run', 'dev'], {
        cwd: fullPath,
        stdio: ['ignore', 'pipe', 'pipe'],
        env: { ...process.env },
        detached: true,
      });
    }

    const entry = {
      name: sub.cwd,
      type: sub.type,
      cwd: fullPath,
      process: proc,
      status: 'running',
      logs: [],
      sessionId,
      detectedPort: null,
      detectedUrl: null,
    };

    const MAX_LOG_LINES = 200;
    const tag = `[dev:${sub.cwd}]`;
    const urlRegex = /https?:\/\/localhost:\d+/g;

    proc.stdout.on('data', (data) => {
      const text = data.toString().trim();
      if (text) {
        console.log(tag, text);
        entry.logs.push(text);
        if (entry.logs.length > MAX_LOG_LINES) entry.logs.splice(0, entry.logs.length - MAX_LOG_LINES);
        if (sub.type === 'frontend' && !entry.detectedUrl) {
          const match = text.match(urlRegex);
          if (match) {
            entry.detectedUrl = match[0];
            entry.detectedPort = parseInt(new URL(match[0]).port, 10);
          }
        }
      }
    });

    proc.stderr.on('data', (data) => {
      const text = data.toString().trim();
      if (text) {
        console.log(tag, text);
        entry.logs.push(text);
        if (entry.logs.length > MAX_LOG_LINES) entry.logs.splice(0, entry.logs.length - MAX_LOG_LINES);
        if (sub.type === 'frontend' && !entry.detectedUrl) {
          const match = text.match(urlRegex);
          if (match) {
            entry.detectedUrl = match[0];
            entry.detectedPort = parseInt(new URL(match[0]).port, 10);
          }
        }
      }
    });

    proc.on('exit', (code) => {
      console.log(tag, `proceso terminado, código: ${code}`);
      entry.status = 'stopped';
      entry.process = null;
    });

    proc.on('error', (err) => {
      console.log(tag, `error: ${err.message}`);
      entry.status = 'error';
      entry.process = null;
    });

    session.instances.set(sub.cwd, entry);
    results.push({ name: sub.cwd, type: sub.type, status: 'running' });

    if (proc && proc.pid) {
      detectInstancePort(entry);
    }
  }

  return results;
}

export function registerBrowserSession(sessionId, { name, url, idSession }) {
  const session = sessions.get(sessionId);
  if (session) {
    session.browserSessions.push({ name, url, idSession });
  }
}

async function closeSessionBrowserSessions(session) {
  for (const bs of session.browserSessions) {
    try {
      await fetch(`${PW_URL}/api/command`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ comando: 'close', parametros: { id_session: bs.idSession } }),
      });
      console.log(`[dev] Navegador cerrado para ${bs.name} (${bs.idSession.slice(0, 8)}…)`);
    } catch (err) {
      console.log(`[dev] Error al cerrar navegador para ${bs.name}:`, err.message);
    }
  }
  session.browserSessions.length = 0;
}

export async function stopBySession(sessionId) {
  const session = sessions.get(sessionId);
  if (!session) return;

  await closeSessionBrowserSessions(session);

  for (const [key, entry] of session.instances) {
    if (entry.process) {
      try {
        process.kill(-entry.process.pid, 'SIGTERM');
      } catch (err) {
        if (err.code !== 'ESRCH') {
          console.log(`[dev] Error al matar proceso ${entry.name}:`, err.message);
        }
      }
      entry.process = null;
    }
    entry.status = 'stopped';
  }

  sessions.delete(sessionId);
}

export async function stopAll() {
  for (const sessionId of sessions.keys()) {
    await stopBySession(sessionId);
  }
}

export function setFrontendPorts(ports, sessionId) {
  const session = sessions.get(sessionId);
  if (session) {
    session.frontendPorts = ports;
  }
}

export function setResolution(res, sessionId) {
  const session = sessions.get(sessionId);
  if (session) {
    session.resolution = res;
  }
}

export function getStatus(sessionId = null) {
  const allProcesses = [];
  let allFrontendPorts = [];
  let allBrowserSessions = [];
  let anyResolution = null;

  if (sessionId != null) {
    sessionId = Number(sessionId);
    const session = sessions.get(sessionId);
    if (session) {
      for (const [key, entry] of session.instances) {
        allProcesses.push({
          name: entry.name,
          type: entry.type,
          status: entry.status,
          sessionId: entry.sessionId,
          detectedPort: entry.detectedPort,
          detectedUrl: entry.detectedUrl,
        });
      }
      allFrontendPorts = session.frontendPorts;
      allBrowserSessions = session.browserSessions.map(bs => ({ name: bs.name, url: bs.url, idSession: bs.idSession }));
      anyResolution = session.resolution;
    }
  } else {
    for (const [sid, session] of sessions) {
      for (const [key, entry] of session.instances) {
        allProcesses.push({
          name: entry.name,
          type: entry.type,
          status: entry.status,
          sessionId: entry.sessionId,
          detectedPort: entry.detectedPort,
          detectedUrl: entry.detectedUrl,
        });
      }
      allFrontendPorts = allFrontendPorts.concat(session.frontendPorts);
      allBrowserSessions = allBrowserSessions.concat(
        session.browserSessions.map(bs => ({ name: bs.name, url: bs.url, idSession: bs.idSession }))
      );
      if (session.resolution) anyResolution = session.resolution;
    }
  }

  return {
    processes: allProcesses,
    frontendPorts: allFrontendPorts,
    browserSessions: allBrowserSessions,
    resolution: anyResolution,
  };
}

export function getLogs(sessionId, name) {
  if (sessionId != null) sessionId = Number(sessionId);
  const session = sessions.get(sessionId);
  if (!session) return [];
  const entry = session.instances.get(name);
  return entry ? entry.logs.slice() : [];
}

export function killPorts(ports) {
  if (!Array.isArray(ports) || ports.length === 0) return [];

  const results = [];

  for (const port of ports) {
    const portNum = parseInt(port, 10);
    if (isNaN(portNum) || portNum < 1 || portNum > 65535) {
      results.push({ port, status: 'error', message: 'Puerto inválido' });
      continue;
    }

    try {
      const output = execSync(`fuser -k ${portNum}/tcp 2>&1`, { timeout: 10000 });
      const stdout = output.toString().trim();

      for (const [sid, session] of sessions) {
        for (const [key, entry] of session.instances) {
          if (entry.detectedPort === portNum) {
            entry.process = null;
            entry.status = 'stopped';
            session.instances.delete(key);
          }
        }
        session.frontendPorts = session.frontendPorts.filter(fp => fp.port !== portNum);
      }

      results.push({ port: portNum, status: 'ok', message: stdout || `Puerto ${portNum} liberado` });
    } catch (err) {
      const stderr = err.stderr ? err.stderr.toString().trim() : '';
      results.push({ port: portNum, status: 'not_found', message: stderr || `No hay procesos en puerto ${portNum}` });
    }
  }

  return results;
}

export async function waitForAllPorts(sessionId, timeout = 20000) {
  const session = sessions.get(sessionId);
  if (!session) return [];

  const start = Date.now();

  while (Date.now() - start < timeout) {
    const active = Array.from(session.instances.values()).filter(e => e.status === 'running');
    const allDetected = active.every(e => e.detectedPort);
    if (allDetected || active.length === 0) break;
    await new Promise(r => setTimeout(r, 300));
  }

  return Array.from(session.instances.values())
    .filter(e => e.detectedPort)
    .map(e => ({ name: e.name, type: e.type, port: e.detectedPort, url: e.detectedUrl }));
}
