import { io } from 'socket.io-client';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { login, getGestionCredentials } from '../gestion/gestion.service.js';
import db from '../../config/db.js';
import dbChatMessages from '../../config/dbChatMessages.js';
import { streamChat } from '../../services/deepseek.js';
import { executeBackendCommand } from '../../services/commandExecutor.js';
import {
  createRemoteTerminal,
  writeRemoteTerminal,
  resizeRemoteTerminal,
  closeRemoteTerminal,
  listRemoteTerminals,
  stopAllRemoteTerminals,
} from './remoteTerminal.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

const ANNOUNCE_INTERVAL_MS = 45000;
const IO_LOG_MAX = 200;
const FILE_LOG_PATH = path.resolve(__dirname, '../../../logs/interfaz_remota.log');

function fileLog(msg) {
  try {
    const line = `[${new Date().toISOString()}] ${msg}\n`;
    fs.appendFileSync(FILE_LOG_PATH, line);
  } catch (err) {
    console.log('[interfaz_remota] error al escribir log a archivo:', err.message);
  }
}

let loginState = {
  attempted: false,
  success: false,
  configured: false,
  token: null,
  url: null,
  message: null,
  requestLog: null,
  checkedAt: null,
};

let wsState = {
  attempted: false,
  connected: false,
  url: null,
  message: null,
  error: null,
  connectedAt: null,
  lastCheckAt: null,
  announce: null,
};

let socket = null;
let wsReconnectTimer = null;
let announceTimer = null;
let enabled = true;

let ioLog = [];
let ioLogIdCounter = 0;
const sseSubscribers = new Set();

const announceId = 'sistema-desarrollo-greenborn';
const announceNombre = 'Sistema de desarrollo';
const announceDetalles = {
  version: process.env.npm_package_version || '1.0.0',
  backend: 'agent-orchestrator-backend',
  puerto: process.env.PORT || null,
};

function resetWsState() {
  wsState = {
    attempted: true,
    connected: false,
    url: null,
    message: 'Sin conexión WebSocket.',
    error: null,
    connectedAt: null,
    lastCheckAt: new Date().toISOString(),
    announce: null,
  };
}

function safeSerialize(value) {
  try {
    return JSON.stringify(value);
  } catch (err) {
    return JSON.stringify(String(value));
  }
}

function appendIoLog(direction, event, data) {
  ioLogIdCounter += 1;
  let payload = null;
  try {
    payload = JSON.parse(safeSerialize(data));
  } catch (err) {
    payload = String(data);
  }
  const entry = {
    id: ioLogIdCounter,
    ts: new Date().toISOString(),
    direction,
    event,
    data: payload,
  };
  ioLog.push(entry);
  if (ioLog.length > IO_LOG_MAX) {
    ioLog = ioLog.slice(ioLog.length - IO_LOG_MAX);
  }
  broadcastIoLog(entry);
  console.log(`[interfaz_remota] io ${direction} "${event}":`, safeSerialize(data).slice(0, 200));
}

function broadcastIoLog(entry) {
  if (sseSubscribers.size === 0) return;
  const frame = `data: ${JSON.stringify({ type: 'io', entry })}\n\n`;
  for (const res of sseSubscribers) {
    try {
      res.write(frame);
    } catch (err) {
      console.log('[interfaz_remota] error al enviar log io por SSE:', err.message);
      sseSubscribers.delete(res);
    }
  }
}

export function subscribeIoEvents(res) {
  sseSubscribers.add(res);
  return () => sseSubscribers.delete(res);
}

export function getInterfazRemotaIoLog() {
  return ioLog;
}

const SESSION_FIELDS = [
  'chat_sessions.id',
  'title',
  'chat_sessions.updated_at',
  'cwd',
  'chat_sessions.proyecto_id',
  'id_ticket_redmine',
  'chat_sessions.workspace_id',
];

async function queryChatSessions() {
  const [activas, archivadas] = await Promise.all([
    db('chat_sessions')
      .where('chat_sessions.archived', false)
      .orderBy('chat_sessions.updated_at', 'desc')
      .limit(200)
      .select(SESSION_FIELDS),
    db('chat_sessions')
      .where('chat_sessions.archived', true)
      .orderBy('chat_sessions.updated_at', 'desc')
      .limit(200)
      .select(SESSION_FIELDS),
  ]);
  console.log(`[interfaz_remota] chatSessions respondidas: ${activas.length} activas, ${archivadas.length} archivadas`);
  return { activas, archivadas };
}

// Serializa las peticiones de sesiones de chat por socket. Evita que múltiples
// ACK concurrentes (reintentos del lado gestión interna, usuarios, etc.) lancen
// consultas DB duplicadas simultáneas que bloquean el event loop y disparan el
// ping timeout -> reconexión del socket.
let chatSessionQueue = Promise.resolve();

function handleChatSessionsRequest(ack) {
  const respond = (payload) => {
    fileLog(`chatSessions respond: success=${payload.success}, activas=${payload.data ? payload.data.activas.length : '-'}, hasAck=${typeof ack === 'function'}`);
    if (typeof ack === 'function') {
      ack(payload);
    } else {
      console.log('[interfaz_remota] chatSessions sin callback ack:', JSON.stringify(payload).slice(0, 120));
    }
  };
  chatSessionQueue = chatSessionQueue.then(async () => {
    try {
      const data = await queryChatSessions();
      respond({ success: true, data });
    } catch (err) {
      console.log('[interfaz_remota] Error al consultar sesiones de chat:', err.message);
      fileLog(`chatSessions error: ${err.message}`);
      respond({ success: false, error: err.message ? err.message : 'Error al consultar sesiones de chat.' });
    }
  });
}

export async function testChatSessions() {
  try {
    const data = await queryChatSessions();
    return { success: true, data, checkedAt: new Date().toISOString() };
  } catch (err) {
    console.log('[interfaz_remota] Error al testear pseudoendpoint de sesiones de chat:', err.message);
    return { success: false, error: err.message ? err.message : 'Error al consultar sesiones de chat.', checkedAt: new Date().toISOString() };
  }
}

// Cola global para serializar las peticiones de pseudoendpoints. Evita que múltiples
// ACK concurrentes (reintentos del lado SGI, usuarios, etc.) lancen operaciones DB /
// streaming duplicados que bloquean el event loop y disparan el ping timeout -> reconexión.
let remotaQueue = Promise.resolve();

function enqueueRemota(work) {
  remotaQueue = remotaQueue.then(work).catch((err) => {
    console.log('[interfaz_remota] Error no manejado en pseudoendpoint:', err.message);
  });
  return remotaQueue;
}

async function getSessionOrNull(sessionId) {
  return db('chat_sessions').where({ id: sessionId }).first();
}

export async function getChatMessages({ sessionId, limit = 200 } = {}) {
  if (!sessionId) return { success: false, error: 'sessionId requerido' };
  const session = await getSessionOrNull(sessionId);
  if (!session) return { success: false, error: 'Sesión de chat no encontrada' };
  const safeLimit = Math.min(Math.max(parseInt(limit, 10) || 200, 1), 500);
  const messages = await dbChatMessages('chat_messages')
    .where({ session_id: sessionId })
    .orderBy('created_at', 'asc')
    .limit(safeLimit)
    .select('id', 'role', 'content', 'thinking', 'created_at');
  return { success: true, data: { sessionId, messages } };
}

export async function sendChatMessage({ sessionId, message } = {}) {
  if (!sessionId) return { success: false, error: 'sessionId requerido' };
  if (!message || typeof message !== 'string' || !message.trim()) {
    return { success: false, error: 'message requerido' };
  }
  const session = await getSessionOrNull(sessionId);
  if (!session) return { success: false, error: 'Sesión de chat no encontrada' };

  await dbChatMessages('chat_messages').insert({ session_id: sessionId, role: 'user', content: message });
  await db('chat_sessions').where({ id: sessionId }).update({ updated_at: db.fn.now() });

  const history = await dbChatMessages('chat_messages')
    .where({ session_id: sessionId })
    .orderBy('created_at', 'asc')
    .select('role', 'content');

  const wsId = session.workspace_id || 1;
  let fullThinking = '';
  let fullResponse = '';
  for await (const chunk of streamChat(history, wsId)) {
    if (chunk.type === 'usage') continue;
    if (chunk.type === 'thinking') {
      fullThinking += chunk.content;
    } else {
      fullResponse += chunk.content;
    }
  }

  await dbChatMessages('chat_messages').insert({
    session_id: sessionId,
    role: 'assistant',
    content: fullResponse,
    thinking: fullThinking ? fullThinking : null,
  });
  await db('chat_sessions').where({ id: sessionId }).update({ updated_at: db.fn.now() });

  return { success: true, data: { content: fullResponse, thinking: fullThinking ? fullThinking : null } };
}

export async function executeChatCommand({ sessionId, command } = {}) {
  if (!sessionId) return { success: false, error: 'sessionId requerido' };
  if (!command || typeof command !== 'string' || !command.trim()) {
    return { success: false, error: 'command requerido' };
  }
  const session = await getSessionOrNull(sessionId);
  if (!session) return { success: false, error: 'Sesión de chat no encontrada' };

  const result = await executeBackendCommand(command, { sessionId });
  await dbChatMessages('chat_messages').insert([
    { session_id: sessionId, role: 'command', content: command },
    { session_id: sessionId, role: 'result', content: result.result },
  ]);
  return { success: true, data: { result: result.result, success: result.success } };
}

export async function createChatSession({ title, cwd } = {}) {
  const generated = title && typeof title === 'string' && title.trim() ? title.trim() : null;
  const insertData = {
    user_id: 1,
    workspace_id: 1,
    cwd: cwd && typeof cwd === 'string' ? cwd : null,
  };
  if (generated) insertData.title = generated;
  const [id] = await db('chat_sessions').insert(insertData);
  const session = await db('chat_sessions').where({ id }).first();
  return { success: true, data: { session } };
}

function makeRemotaHandler(work) {
  return (payload, ack) => {
    const respond = (resp) => {
      if (typeof ack === 'function') {
        ack(resp);
      } else {
        console.log('[interfaz_remota] pseudoendpoint sin callback ack:', JSON.stringify(resp).slice(0, 120));
      }
    };
    const body = payload && typeof payload === 'object' ? payload : {};
    enqueueRemota(async () => {
      try {
        const resp = await work(body);
        respond(resp);
      } catch (err) {
        console.log('[interfaz_remota] Error en pseudoendpoint:', err.message);
        respond({ success: false, error: err.message ? err.message : 'Error interno del pseudoendpoint' });
      }
    });
  };
}

function emitAnnounce() {
  if (!socket || !socket.connected) {
    console.log('[interfaz_remota] No se puede anunciar: socket no conectado.');
    return;
  }
  socket.emit('desarrollo:announce', {
    id: announceId,
    nombre: announceNombre,
    detalles: announceDetalles,
  }, (resp) => {
    if (resp && resp.success) {
      wsState.announce = resp.data || null;
      wsState.message = 'Sistema anunciado en gestión interna.';
      console.log('[interfaz_remota] desarrollo:announce OK, sistemas conectados:', resp.data ? resp.data.cantidad : 0);
    } else {
      wsState.announce = null;
      const msg = resp && resp.error ? resp.error : 'Sin ACK de announce';
      wsState.message = 'Error al anunciar sistema.';
      console.log('[interfaz_remota] desarrollo:announce falló:', msg);
    }
  });
}

function scheduleAnnounce() {
  if (announceTimer) {
    clearInterval(announceTimer);
  }
  announceTimer = setInterval(() => {
    emitAnnounce();
  }, ANNOUNCE_INTERVAL_MS);
}

export function connectInterfazRemotaWs(gestionUrl, token) {
  if (!enabled) {
    console.log('[interfaz_remota] Conexión deshabilitada, no se conecta.');
    return;
  }
  if (socket) {
    return;
  }

  if (wsReconnectTimer) {
    clearTimeout(wsReconnectTimer);
    wsReconnectTimer = null;
  }

  const baseUrl = gestionUrl.replace(/\/+$/, '');
  const socketUrl = baseUrl.replace(/^https?:\/\//, '');
  const isSecure = baseUrl.startsWith('https:');

  resetWsState();
  wsState.url = baseUrl;

  try {
    socket = io(isSecure ? `https://${socketUrl}` : `http://${socketUrl}`, {
      path: '/socket.io',
      transports: ['websocket', 'polling'],
      auth: { token },
      reconnection: true,
      reconnectionDelay: 5000,
      reconnectionDelayMax: 15000,
      timeout: 20000,
      reconnectionAttempts: Infinity,
    });
  } catch (err) {
    wsState.error = err.message ? err.message : 'Error al crear conexión socket.io.';
    wsState.message = 'Error al conectar socket.io.';
    console.log('[interfaz_remota] Error al crear socket.io:', err.message);
    scheduleWsRetry();
    return;
  }

  socket.on('connect', () => {
    wsState.connected = true;
    wsState.connectedAt = new Date().toISOString();
    wsState.message = 'Socket conectado al servicio de gestión interna.';
    wsState.error = null;
    console.log('[interfaz_remota] socket.io conectado:', socket.id);
    fileLog(`CONNECT socket.id=${socket.id}`);
    emitAnnounce();
    scheduleAnnounce();
  });

  socket.on('disconnect', (reason) => {
    wsState.connected = false;
    wsState.connectedAt = null;
    wsState.announce = null;
    wsState.message = `Conexión socket.io cerrada (${reason}).`;
    console.log('[interfaz_remota] socket.io desconectado:', reason);
    fileLog(`DISCONNECT reason=${reason}`);
    stopAllRemoteTerminals();
    if (announceTimer) {
      clearInterval(announceTimer);
      announceTimer = null;
    }
  });

  socket.on('connect_error', (err) => {
    wsState.connected = false;
    wsState.error = err.message ? err.message : 'Error socket.io.';
    wsState.message = 'Error en la conexión socket.io.';
    console.log('[interfaz_remota] socket.io connect_error:', err.message);
    fileLog(`CONNECT_ERROR ${err.message}`);
  });

  socket.on('desarrollo:status', (payload) => {
    console.log('[interfaz_remota] desarrollo:status recibido:', JSON.stringify(payload).slice(0, 120));
  });

  socket.on('interfaz-remota:chatSessions', (payload, ack) => {
    const cb = typeof ack === 'function' ? ack : (typeof payload === 'function' ? payload : null);
    fileLog(`EVENT interfaz-remota:chatSessions recibido, ack=${typeof ack}, payloadIsFn=${typeof payload}`);
    handleChatSessionsRequest(cb);
  });

  socket.on('interfaz-remota:getMessages', makeRemotaHandler((body) => getChatMessages(body)));
  socket.on('interfaz-remota:sendMessage', makeRemotaHandler((body) => sendChatMessage(body)));
  socket.on('interfaz-remota:sendCommand', makeRemotaHandler((body) => executeChatCommand(body)));
  socket.on('interfaz-remota:crearSesion', makeRemotaHandler((body) => createChatSession(body)));

  const emitRemoto = (event, payload) => {
    if (socket && socket.connected) {
      socket.emit(event, payload);
    }
  };
  socket.on('interfaz-remota:terminal:create', makeRemotaHandler((body) => createRemoteTerminal({ ...body, emit: emitRemoto })));
  socket.on('interfaz-remota:terminal:input', makeRemotaHandler((body) => writeRemoteTerminal(body)));
  socket.on('interfaz-remota:terminal:resize', makeRemotaHandler((body) => resizeRemoteTerminal(body)));
  socket.on('interfaz-remota:terminal:close', makeRemotaHandler((body) => closeRemoteTerminal(body)));
  socket.on('interfaz-remota:terminal:list', makeRemotaHandler((body) => listRemoteTerminals(body)));

  socket.onAny((event, ...args) => {
    appendIoLog('in', event, args.length === 1 ? args[0] : args);
  });

  socket.onAnyOutgoing((event, ...args) => {
    appendIoLog('out', event, args.length === 1 ? args[0] : args);
  });
}

function scheduleWsRetry() {
  if (wsReconnectTimer) {
    clearTimeout(wsReconnectTimer);
  }
  wsReconnectTimer = setTimeout(() => {
    if (loginState.configured && loginState.url && loginState.token) {
      connectInterfazRemotaWs(loginState.url, loginState.token);
    }
  }, 5000);
}

export function getInterfazRemotaWsState() {
  return wsState;
}

export function stopInterfazRemotaWs() {
  if (wsReconnectTimer) {
    clearTimeout(wsReconnectTimer);
    wsReconnectTimer = null;
  }
  if (announceTimer) {
    clearInterval(announceTimer);
    announceTimer = null;
  }
  if (socket) {
    try {
      socket.removeAllListeners();
      socket.disconnect();
    } catch (err) {
      console.log('[interfaz_remota] error al cerrar socket.io:', err.message);
    }
    socket = null;
  }
  stopAllRemoteTerminals();
  wsState = {
    attempted: false,
    connected: false,
    url: null,
    message: null,
    error: null,
    connectedAt: null,
    lastCheckAt: null,
    announce: null,
  };
  ioLog = [];
  ioLogIdCounter = 0;
}

export async function initInterfazRemotaLogin() {
  loginState = {
    attempted: true,
    success: false,
    configured: false,
    token: null,
    url: null,
    message: null,
    requestLog: null,
    checkedAt: new Date().toISOString(),
  };

  try {
    const creds = await getGestionCredentials(1);
    if (!creds) {
      loginState.configured = false;
      loginState.message = 'Gestión interna no configurada.';
      console.log('[interfaz_remota] No hay credenciales de gestión interna configuradas.');
      return loginState;
    }

    loginState.configured = true;
    loginState.url = creds.gestionUrl;

    const result = await login(creds.gestionUrl, creds.username, creds.password);
    loginState.success = true;
    loginState.token = result.token;
    loginState.requestLog = result.requestLog;
    loginState.message = 'Login exitoso en gestión interna.';
    console.log('[interfaz_remota] Login exitoso en gestión interna.');

    connectInterfazRemotaWs(creds.gestionUrl, result.token);
  } catch (err) {
    loginState.success = false;
    loginState.message = err.message ? err.message : 'Error al conectar con gestión interna.';
    loginState.requestLog = err.requestLog ? err.requestLog : null;
    console.log('[interfaz_remota] Error en login a gestión interna:', err.message);
  }

  return loginState;
}

export function getInterfazRemotaLoginState() {
  return loginState;
}

export function getInterfazRemotaEnabled() {
  return enabled;
}

export function setInterfazRemotaEnabled(value) {
  enabled = value === true || value === 'true' || value === '1' || value === 1;
  if (!enabled) {
    stopInterfazRemotaWs();
    loginState.attempted = false;
    loginState.success = false;
    loginState.token = null;
    loginState.message = 'Conexión deshabilitada por el usuario.';
    loginState.checkedAt = new Date().toISOString();
  }
  return enabled;
}

export function enableInterfazRemota() {
  enabled = true;
  return initInterfazRemotaLogin();
}

export function getInterfazRemotaStatus() {
  return {
    enabled,
    login: loginState,
    ws: wsState,
    ioLog,
  };
}
