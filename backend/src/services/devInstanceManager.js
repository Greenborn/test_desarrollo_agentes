import { spawn } from 'child_process';
import path from 'path';
import fs from 'fs';

const instances = new Map();

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

export async function startDevInstance(projectRoot, deployConfig) {
  stopAll();

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
      });
    } else {
      proc = spawn('npm', ['run', 'dev'], {
        cwd: fullPath,
        stdio: ['ignore', 'pipe', 'pipe'],
        env: { ...process.env },
      });
    }

    const entry = {
      name: sub.cwd,
      type: sub.type,
      cwd: fullPath,
      process: proc,
      status: 'running',
      logs: [],
    };

    const MAX_LOG_LINES = 200;
    const tag = `[dev:${sub.cwd}]`;

    proc.stdout.on('data', (data) => {
      const text = data.toString().trim();
      if (text) {
        console.log(tag, text);
        entry.logs.push(text);
        if (entry.logs.length > MAX_LOG_LINES) entry.logs.splice(0, entry.logs.length - MAX_LOG_LINES);
      }
    });

    proc.stderr.on('data', (data) => {
      const text = data.toString().trim();
      if (text) {
        console.log(tag, text);
        entry.logs.push(text);
        if (entry.logs.length > MAX_LOG_LINES) entry.logs.splice(0, entry.logs.length - MAX_LOG_LINES);
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

    instances.set(sub.cwd, entry);
    results.push({ name: sub.cwd, type: sub.type, status: 'running' });
  }

  return results;
}

export function stopAll() {
  for (const [key, entry] of instances) {
    if (entry.process) {
      entry.process.kill();
      entry.process = null;
    }
    entry.status = 'stopped';
  }
  instances.clear();
}

export function getStatus() {
  const arr = [];
  for (const [key, entry] of instances) {
    arr.push({ name: entry.name, type: entry.type, status: entry.status });
  }
  return arr;
}

export function getLogs(name) {
  const entry = instances.get(name);
  return entry ? entry.logs.slice() : [];
}
