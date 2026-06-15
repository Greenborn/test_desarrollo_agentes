import { spawn } from 'child_process';
import db from '../config/db.js';

let opencodeProcess = null;
const BASE_URL = `http://localhost:${process.env.OPENCODE_PORT || 4097}`;
let ready = false;

function startProcess() {
  if (opencodeProcess) return;
  const port = process.env.OPENCODE_PORT || 4097;
  opencodeProcess = spawn('opencode', ['serve', '--port', String(port)], {
    stdio: ['ignore', 'pipe', 'pipe'],
    env: { ...process.env },
  });

  opencodeProcess.stdout.on('data', (data) => {
    const text = data.toString();
    console.log('[opencode]', text.trim());
    if (text.includes('listening') || text.includes('Server')) {
      ready = true;
    }
  });

  opencodeProcess.stderr.on('data', (data) => {
    console.log('[opencode stderr]', data.toString().trim());
    if (data.toString().includes('listening') || data.toString().includes('Server')) {
      ready = true;
    }
  });

  opencodeProcess.on('exit', (code) => {
    console.log('[opencode] proceso terminado, código:', code);
    opencodeProcess = null;
    ready = false;
  });

  opencodeProcess.on('error', (err) => {
    console.log('[opencode] error al iniciar:', err.message);
    opencodeProcess = null;
    ready = false;
  });
}

function stopProcess() {
  if (opencodeProcess) {
    opencodeProcess.kill();
    opencodeProcess = null;
    ready = false;
  }
}

async function waitForReady(timeout = 15000) {
  const start = Date.now();
  while (!ready) {
    if (Date.now() - start > timeout) {
      throw new Error('Timeout esperando que opencode sirva');
    }
    try {
      const res = await fetch(`${BASE_URL}/global/health`);
      if (res.ok) {
        ready = true;
        return;
      }
    } catch {}
    await new Promise((r) => setTimeout(r, 500));
  }
}

async function api(path, options = {}) {
  const url = `${BASE_URL}${path}`;
  const res = await fetch(url, {
    headers: { 'Content-Type': 'application/json', ...options.headers },
    ...options,
  });
  if (!res.ok) {
    const text = await res.text();
    throw new Error(`OpenCode API error ${res.status}: ${text}`);
  }
  return res.json();
}

async function getModels() {
  const data = await api('/config/providers');
  return data;
}

async function createSession(title) {
  const data = await api('/session', {
    method: 'POST',
    body: JSON.stringify({ title: title || 'Agent Orchestrator session' }),
  });
  return data;
}

async function sendMessage(sessionId, parts, options = {}) {
  const body = {
    parts: Array.isArray(parts) ? parts : [{ type: 'text', text: parts }],
    ...options,
  };
  const data = await api(`/session/${sessionId}/message`, {
    method: 'POST',
    body: JSON.stringify(body),
  });
  return data;
}

async function sendPromptAsync(sessionId, parts, options = {}) {
  const body = {
    parts: Array.isArray(parts) ? parts : [{ type: 'text', text: parts }],
    ...options,
  };
  await fetch(`${BASE_URL}/session/${sessionId}/prompt_async`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
}

async function respondToPermission(sessionId, permissionId, response, remember) {
  const data = await api(`/session/${sessionId}/permissions/${permissionId}`, {
    method: 'POST',
    body: JSON.stringify({ response, remember: remember || false }),
  });
  return data;
}

async function abortSession(sessionId) {
  await api(`/session/${sessionId}/abort`, { method: 'POST' });
}

async function getSessionDiff(sessionId) {
  const data = await api(`/session/${sessionId}/diff`);
  return data;
}

async function getSessionMessages(sessionId) {
  const res = await fetch(`${BASE_URL}/session/${sessionId}/message`);
  if (!res.ok) return [];
  const data = await res.json();
  return data;
}

async function executeCommand(sessionId, command, args) {
  const data = await api(`/session/${sessionId}/command`, {
    method: 'POST',
    body: JSON.stringify({ command, arguments: args }),
  });
  return data;
}

async function getEvents(sessionId) {
  const res = await fetch(`${BASE_URL}/event`);
  return res;
}

async function getSessionStatus(sessionId) {
  try {
    const data = await api(`/session/${sessionId}`);
    return data;
  } catch {
    return null;
  }
}

function isReady() {
  return ready;
}

export default {
  startProcess,
  stopProcess,
  waitForReady,
  getModels,
  createSession,
  sendMessage,
  sendPromptAsync,
  respondToPermission,
  abortSession,
  getSessionDiff,
  getSessionMessages,
  executeCommand,
  getEvents,
  getSessionStatus,
  isReady,
};
