import { io } from 'socket.io-client';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { login, getGestionCredentials } from '../gestion/gestion.service.js';
import db from '../../config/db.js';
import dbChatMessages from '../../config/dbChatMessages.js';
import dbRedmineData from '../../config/dbRedmineData.js';
import { streamChat } from '../../services/deepseek.js';
import { executeBackendCommand } from '../../services/commandExecutor.js';
import {
  listarComandosPorProyecto,
  obtenerComandoPersonalizado,
  ejecutarComandoPersonalizado,
} from '../../services/comandosPersonalizados.service.js';
import { runOpencodePrompt, controlEmitter } from '../../services/opencodeStream.js';
import * as hub from '../../services/componentHub.js';
import * as terminalBridge from '../../services/terminalBridge.js';
import opencode from '../../services/opencode.js';
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
// Margen de seguridad para renovar el token antes de que expire. El token del
// login SGI tiene un TTL de 24h (ver sgi-backend/src/auth/sso.js); renovamos
// cada ~7h para disponer siempre de un token fresco para futuras reconexiones
// y así nunca quedarnos fuera por expiración.
const TOKEN_RENEW_INTERVAL_MS = 7 * 60 * 60 * 1000;
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
let tokenRenewTimer = null;
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
  const [enrActivas, enrArchivadas] = await Promise.all([
    enriquecerSesiones(activas),
    enriquecerSesiones(archivadas),
  ]);
  return { activas: enrActivas, archivadas: enrArchivadas };
}

// Caché breve de lecturas para que refrescos de sesiones no golpeen la DB en cada
// consulta. Se invalida al escribir (nueva sesión / mensaje). TTL corto para no
// servir datos obsoletos durante mucho tiempo.
const CHAT_SESSIONS_TTL_MS = 5000;
let chatSessionsCache = { at: 0, data: null };

async function queryChatSessionsCached() {
  const now = Date.now();
  if (chatSessionsCache.data && now - chatSessionsCache.at < CHAT_SESSIONS_TTL_MS) {
    return chatSessionsCache.data;
  }
  const data = await queryChatSessions();
  chatSessionsCache = { at: now, data };
  return data;
}

function invalidateChatSessionsCache() {
  chatSessionsCache = { at: 0, data: null };
}

// Caché breve por sesión del historial de mensajes (getMessages). Se invalida al
// insertar mensajes para que el próximo refresco traiga el estado actual.
const MESSAGES_TTL_MS = 3000;
const messagesCache = new Map();

function invalidateMessagesCache(sessionId) {
  if (sessionId !== undefined && sessionId !== null) {
    messagesCache.delete(String(sessionId));
  }
}

async function getChatMessagesCached({ sessionId, limit = 200 } = {}) {
  if (sessionId === undefined || sessionId === null) return { success: false, error: 'sessionId requerido' };
  const key = String(sessionId);
  const now = Date.now();
  const entry = messagesCache.get(key);
  if (entry && now - entry.at < MESSAGES_TTL_MS) {
    return entry.data;
  }
  const data = await getChatMessages({ sessionId, limit });
  messagesCache.set(key, { at: now, data });
  return data;
}

// Agrega a cada sesion el slug del proyecto asociado (join a proyectos) y el
// ambiente al que pertenece (nombre del workspace). Los datos se exponen en el
// payload para que el selector de sesiones de la gestion interna los muestre.
async function enriquecerSesiones(sesiones) {
  if (!sesiones || sesiones.length === 0) return sesiones;

  const proyectoIds = [...new Set(sesiones.map((s) => s.proyecto_id).filter(Boolean))];
  const workspaceIds = [...new Set(sesiones.map((s) => s.workspace_id).filter(Boolean))];

  const [proyectos, workspaces] = await Promise.all([
    proyectoIds.length > 0
      ? dbRedmineData('proyectos').whereIn('id', proyectoIds).select('id')
      : Promise.resolve([]),
    workspaceIds.length > 0
      ? db('workspaces').whereIn('id', workspaceIds).select('id', 'name')
      : Promise.resolve([]),
  ]);

  const proyectoMap = {};
  for (const p of proyectos) proyectoMap[p.id] = p;
  const workspaceMap = {};
  for (const w of workspaces) workspaceMap[w.id] = w;

  for (const s of sesiones) {
    if (s.proyecto_id && proyectoMap[s.proyecto_id]) {
      s.proyecto_slug = proyectoMap[s.proyecto_id].id;
    }
    if (s.workspace_id && workspaceMap[s.workspace_id]) {
      s.ambiente = workspaceMap[s.workspace_id].name;
    }
  }
  return sesiones;
}

// Serializa las peticiones de sesiones de chat por socket. Evita que múltiples
// ACK concurrentes (reintentos del lado gestión interna, usuarios, etc.) lancen
// consultas DB duplicadas simultáneas que bloquean el event loop y disparan el
// ping timeout -> reconexión del socket.
let chatSessionQueue = Promise.resolve();

function handleChatSessionsRequest(ack) {
  const respond = (payload) => {
    // No se escribe a disco en cada refresh (I/O síncrona en camino caliente); el
    // tráfico IO ya queda visible vía console/SSE en `appendIoLog`.
    if (typeof ack === 'function') {
      ack(payload);
    } else {
      console.log('[interfaz_remota] chatSessions sin callback ack:', JSON.stringify(payload).slice(0, 120));
    }
  };
  chatSessionQueue = chatSessionQueue.then(async () => {
    try {
      const data = await queryChatSessionsCached();
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
    const data = await queryChatSessionsCached();
    return { success: true, data, checkedAt: new Date().toISOString() };
  } catch (err) {
    console.log('[interfaz_remota] Error al testear pseudoendpoint de sesiones de chat:', err.message);
    return { success: false, error: err.message ? err.message : 'Error al consultar sesiones de chat.', checkedAt: new Date().toISOString() };
  }
}

// Colas por sesión para serializar las peticiones de pseudoendpoints. Evita que
// operaciones largas (streaming de chat, prompts opencode) bloqueen el event loop
// o a otras sesiones: cada sesión mantiene su propio orden, pero sesiones distintas
// corren en paralelo. La clave '__global__' agrupa las peticiones sin sesión.
const remotaQueues = new Map();

function remotaQueueKey(body) {
  const id = body && (body.sessionId !== undefined ? body.sessionId : body.chatSessionId);
  return id !== undefined && id !== null ? String(id) : '__global__';
}

function enqueueRemota(body, work) {
  const key = remotaQueueKey(body);
  const prev = remotaQueues.get(key) || Promise.resolve();
  const chain = prev.then(work).catch((err) => {
    console.log('[interfaz_remota] Error no manejado en pseudoendpoint:', err.message);
  });
  remotaQueues.set(key, chain);
  return chain;
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
  invalidateMessagesCache(sessionId);
  invalidateChatSessionsCache();

  return { success: true, data: { content: fullResponse, thinking: fullThinking ? fullThinking : null } };
}

// Variante streaming de sendMessage para socket: ACK inmediato (via makeStreamingHandler)
// y el progreso (thinking/response/done/error) se emite por `interfaz-remota:message:event`.
export async function sendChatMessageStreaming({ sessionId, message } = {}, emitEvent) {
  if (!sessionId) {
    if (emitEvent) emitEvent('interfaz-remota:message:event', { chatSessionId: sessionId, sessionId, kind: 'message', type: 'error', error: 'sessionId requerido' });
    return;
  }
  if (!message || typeof message !== 'string' || !message.trim()) {
    if (emitEvent) emitEvent('interfaz-remota:message:event', { chatSessionId: sessionId, sessionId, kind: 'message', type: 'error', error: 'message requerido' });
    return;
  }
  const session = await getSessionOrNull(sessionId);
  if (!session) {
    if (emitEvent) emitEvent('interfaz-remota:message:event', { chatSessionId: sessionId, sessionId, kind: 'message', type: 'error', error: 'Sesión de chat no encontrada' });
    return;
  }

  await dbChatMessages('chat_messages').insert({ session_id: sessionId, role: 'user', content: message });
  await db('chat_sessions').where({ id: sessionId }).update({ updated_at: db.fn.now() });
  invalidateMessagesCache(sessionId);
  invalidateChatSessionsCache();

  const history = await dbChatMessages('chat_messages')
    .where({ session_id: sessionId })
    .orderBy('created_at', 'asc')
    .select('role', 'content');

  const wsId = session.workspace_id || 1;
  let fullThinking = '';
  let fullResponse = '';
  const push = (type, content) => {
    if (emitEvent) emitEvent('interfaz-remota:message:event', { chatSessionId: sessionId, sessionId, kind: 'message', type, content });
  };
  for await (const chunk of streamChat(history, wsId)) {
    if (chunk.type === 'usage') continue;
    if (chunk.type === 'thinking') {
      fullThinking += chunk.content;
      push('thinking', chunk.content);
    } else {
      fullResponse += chunk.content;
      push('response', chunk.content);
    }
  }

  await dbChatMessages('chat_messages').insert({
    session_id: sessionId,
    role: 'assistant',
    content: fullResponse,
    thinking: fullThinking ? fullThinking : null,
  });
  await db('chat_sessions').where({ id: sessionId }).update({ updated_at: db.fn.now() });
  invalidateMessagesCache(sessionId);
  invalidateChatSessionsCache();

  if (emitEvent) {
    emitEvent('interfaz-remota:message:event', {
      chatSessionId: sessionId,
      sessionId,
      kind: 'message',
      type: 'done',
      data: { content: fullResponse, thinking: fullThinking ? fullThinking : null },
    });
  }
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
  invalidateMessagesCache(sessionId);
  invalidateChatSessionsCache();
  return { success: true, data: { result: result.result, success: result.success } };
}

// Variante streaming de executeChatCommand para socket: ACK inmediato (via
// makeStreamingHandler) y el resultado se entrega por `interfaz-remota:message:event`.
export async function executeChatCommandStreaming({ sessionId, command } = {}, emitEvent) {
  if (!sessionId) {
    if (emitEvent) emitEvent('interfaz-remota:message:event', { chatSessionId: sessionId, sessionId, kind: 'command', type: 'error', error: 'sessionId requerido' });
    return;
  }
  if (!command || typeof command !== 'string' || !command.trim()) {
    if (emitEvent) emitEvent('interfaz-remota:message:event', { chatSessionId: sessionId, sessionId, kind: 'command', type: 'error', error: 'command requerido' });
    return;
  }
  const session = await getSessionOrNull(sessionId);
  if (!session) {
    if (emitEvent) emitEvent('interfaz-remota:message:event', { chatSessionId: sessionId, sessionId, kind: 'command', type: 'error', error: 'Sesión de chat no encontrada' });
    return;
  }

  const result = await executeBackendCommand(command, { sessionId });
  await dbChatMessages('chat_messages').insert([
    { session_id: sessionId, role: 'command', content: command },
    { session_id: sessionId, role: 'result', content: result.result },
  ]);
  invalidateMessagesCache(sessionId);
  invalidateChatSessionsCache();
  if (emitEvent) {
    emitEvent('interfaz-remota:message:event', {
      chatSessionId: sessionId,
      sessionId,
      kind: 'command',
      type: 'done',
      data: { result: result.result, success: result.success },
    });
  }
}

// Lista los comandos personalizados del proyecto al que pertenece la sesión.
export async function listComandosPersonalizados({ sessionId } = {}) {
  if (!sessionId) return { success: false, error: 'sessionId requerido' };
  const session = await getSessionOrNull(sessionId);
  if (!session) return { success: false, error: 'Sesión de chat no encontrada' };
  const comandos = await listarComandosPorProyecto(session.proyecto_id);
  return { success: true, data: { sessionId, comandos } };
}

// Ejecuta un comando personalizado sobre una sesión. Resuelve variables y cwd de la
// sesión, captura la salida completa y persiste los mensajes `command` y `result`.
export async function ejecutarComandoPersonalizadoRemoto({ sessionId, comandoId } = {}) {
  if (!sessionId) return { success: false, error: 'sessionId requerido' };
  if (!comandoId) return { success: false, error: 'comandoId requerido' };
  const session = await getSessionOrNull(sessionId);
  if (!session) return { success: false, error: 'Sesión de chat no encontrada' };

  let comando;
  try {
    comando = await obtenerComandoPersonalizado(comandoId);
  } catch (err) {
    console.log('[interfaz_remota] Error al obtener comando personalizado:', err.message);
    return { success: false, error: 'Error al consultar comando personalizado' };
  }
  if (!comando) return { success: false, error: 'Comando personalizado no encontrado' };

  let res;
  try {
    res = await ejecutarComandoPersonalizado(comandoId, sessionId);
  } catch (err) {
    console.log('[interfaz_remota] Error al ejecutar comando personalizado:', err.message);
    return { success: false, error: err.message ? err.message : 'Error al ejecutar comando personalizado' };
  }

  const labelComando = comando.label ? `${comando.label}: ${res.shellCommand}` : res.shellCommand;
  await dbChatMessages('chat_messages').insert([
    { session_id: sessionId, role: 'command', content: labelComando },
    { session_id: sessionId, role: 'result', content: res.output },
  ]);
  await db('chat_sessions').where({ id: sessionId }).update({ updated_at: db.fn.now() });
  invalidateMessagesCache(sessionId);
  invalidateChatSessionsCache();

  return {
    success: true,
    data: { result: res.output, success: res.success, ocultarEjecucion: res.ocultarEjecucion },
  };
}

// Variante streaming de ejecutarComandoPersonalizadoRemoto para socket: ACK inmediato
// (via makeStreamingHandler) y el resultado se entrega por `interfaz-remota:message:event`.
export async function ejecutarComandoPersonalizadoRemotoStreaming({ sessionId, comandoId } = {}, emitEvent) {
  if (!sessionId) {
    if (emitEvent) emitEvent('interfaz-remota:message:event', { chatSessionId: sessionId, sessionId, kind: 'comando', type: 'error', error: 'sessionId requerido', comandoId });
    return;
  }
  if (!comandoId) {
    if (emitEvent) emitEvent('interfaz-remota:message:event', { chatSessionId: sessionId, sessionId, kind: 'comando', type: 'error', error: 'comandoId requerido', comandoId });
    return;
  }
  const session = await getSessionOrNull(sessionId);
  if (!session) {
    if (emitEvent) emitEvent('interfaz-remota:message:event', { chatSessionId: sessionId, sessionId, kind: 'comando', type: 'error', error: 'Sesión de chat no encontrada', comandoId });
    return;
  }

  let comando;
  try {
    comando = await obtenerComandoPersonalizado(comandoId);
  } catch (err) {
    console.log('[interfaz_remota] Error al obtener comando personalizado:', err.message);
    if (emitEvent) emitEvent('interfaz-remota:message:event', { chatSessionId: sessionId, sessionId, kind: 'comando', type: 'error', error: 'Error al consultar comando personalizado', comandoId });
    return;
  }
  if (!comando) {
    if (emitEvent) emitEvent('interfaz-remota:message:event', { chatSessionId: sessionId, sessionId, kind: 'comando', type: 'error', error: 'Comando personalizado no encontrado', comandoId });
    return;
  }

  let res;
  try {
    res = await ejecutarComandoPersonalizado(comandoId, sessionId);
  } catch (err) {
    console.log('[interfaz_remota] Error al ejecutar comando personalizado:', err.message);
    if (emitEvent) emitEvent('interfaz-remota:message:event', { chatSessionId: sessionId, sessionId, kind: 'comando', type: 'error', error: err.message ? err.message : 'Error al ejecutar comando personalizado', comandoId });
    return;
  }

  const labelComando = comando.label ? `${comando.label}: ${res.shellCommand}` : res.shellCommand;
  await dbChatMessages('chat_messages').insert([
    { session_id: sessionId, role: 'command', content: labelComando },
    { session_id: sessionId, role: 'result', content: res.output },
  ]);
  await db('chat_sessions').where({ id: sessionId }).update({ updated_at: db.fn.now() });
  invalidateMessagesCache(sessionId);
  invalidateChatSessionsCache();

  if (emitEvent) {
    emitEvent('interfaz-remota:message:event', {
      chatSessionId: sessionId,
      sessionId,
      kind: 'comando',
      type: 'done',
      comandoId,
      data: { result: res.output, success: res.success, ocultarEjecucion: res.ocultarEjecucion },
    });
  }
}

// Lista los componentes en ejecución de una sesión (terminales + agentes opencode),
// iniciando el bridge de terminales y descubriendo agentes opencode activos.
export async function listComponentes({ sessionId } = {}) {
  if (!sessionId) return { success: false, error: 'sessionId requerido' };
  const session = await getSessionOrNull(sessionId);
  if (!session) return { success: false, error: 'Sesión de chat no encontrada' };

  // Puentear terminales del servicio local (sin modificar api_procesos_consola)
  try { terminalBridge.ensureSession(sessionId); } catch (err) {
    console.log('[interfaz_remota] error al iniciar bridge de terminales:', err.message);
  }

  // Descubrir agentes opencode en ejecución y registrarlos en el hub si faltan
  try {
    const sessions = await opencode.listSessions(sessionId);
    for (const s of (Array.isArray(sessions) ? sessions : [])) {
      if (s && s.id && !hub.getComponent(s.id)) {
        hub.register({
          componentId: s.id,
          kind: 'opencode',
          sessionId,
          label: s.title ? `OpenCode: ${s.title}` : 'OpenCode',
          meta: { agent: s.agent || null, ocSessionId: s.id },
        });
      }
    }
  } catch (err) {
    console.log('[interfaz_remota] error al listar sesiones opencode:', err.message);
  }

  const componentes = hub.listBySession(sessionId);
  return { success: true, data: { sessionId, componentes } };
}

// Envía input a una terminal puenteada.
export function componentInput({ sessionId, terminalId, data } = {}) {
  if (!terminalId) return { success: false, error: 'terminalId requerido' };
  if (data === null || data === undefined) return { success: false, error: 'data requerido' };
  return terminalBridge.sendInput(sessionId, terminalId, data);
}

// Redimensiona una terminal puenteada.
export function componentResize({ sessionId, terminalId, cols, rows } = {}) {
  if (!terminalId) return { success: false, error: 'terminalId requerido' };
  return terminalBridge.resize(sessionId, terminalId, cols, rows);
}

// Detiene el monitoreo de componentes de una sesión (liberación de recursos).
export function stopComponentesSession({ sessionId } = {}) {
  if (sessionId) terminalBridge.stopSession(sessionId);
  return { success: true };
}

// Confirma un control interactivo de OpenCode (permisos) emitido por el socket.
// El SGI envía { sessionId, controlId, value }; se resuelve el wait de `processControl`.
export function handleSendControl(body = {}) {
  const controlId = body?.controlId;
  if (!controlId) return { success: false, error: 'controlId requerido' };
  const value = body?.value;
  const response = value === 'no' ? 'no' : 'yes';
  controlEmitter.emit(`control-${controlId}`, { response, remember: false });
  return { success: true, data: { ok: true } };
}

// Lanza un prompt hacia el agente OpenCode por socket y emite el streaming
// (terminal, thinking, response, control, done, error) como eventos
// `interfaz-remota:opencode:event` de vuelta al SGI.
export function runOpencodePromptSocket(body = {}, emit) {
  const { sessionId, prompt } = body || {};
  if (!prompt) return { success: false, error: 'prompt requerido' };
  if (!sessionId) return { success: false, error: 'sessionId requerido' };

  const onEvent = (event) => {
    if (typeof emit !== 'function') return;
    try {
      emit('interfaz-remota:opencode:event', { ...event, chatSessionId: sessionId });
    } catch (err) {
      console.log('[interfaz_remota] error al emitir opencode:event:', err.message);
    }
  };

  (async () => {
    try {
      let workspaceIds = [1];
      if (sessionId) {
        const sess = await db('chat_sessions').where({ id: sessionId }).select('workspace_id').first();
        if (sess && sess.workspace_id) workspaceIds = [sess.workspace_id];
      }
      await runOpencodePrompt({ ...body, workspaceIds, onEvent });
    } catch (err) {
      console.log('[interfaz_remota] Error en opencode prompt:', err.message);
      onEvent({ type: 'error', content: err.message, agentId: null });
    }
  })();

  return { success: true, data: { started: true } };
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
  invalidateChatSessionsCache();
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
    enqueueRemota(body, async () => {
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

// Handler de pseudoendpoint "streaming": ACK inmediato con `{ started: true }` y la
// respuesta/progreso se entrega después por eventos vía `emit`. Evita que operaciones
// largas (chat, comandos, opencode) mantengan en vuelo un ACK (timeout del SGI) y que
// bloqueen la cola. Se ejecuta en paralelo (no serializa) para que la UI responda al
// instante; la duplicación por reintentos del SGI ya está evitada por su `emisionActiva`.
function makeStreamingHandler(work, emit) {
  return (payload, ack) => {
    const respond = (resp) => {
      if (typeof ack === 'function') {
        ack(resp);
      } else {
        console.log('[interfaz_remota] pseudoendpoint streaming sin callback ack:', JSON.stringify(resp).slice(0, 120));
      }
    };
    const body = payload && typeof payload === 'object' ? payload : {};
    const emitEvent = (event, data) => {
      if (typeof emit === 'function') {
        try {
          emit(event, data);
        } catch (err) {
          console.log('[interfaz_remota] error al emitir evento streaming:', err.message);
        }
      }
    };
    const sessionId = body && (body.sessionId !== undefined ? body.sessionId : body.chatSessionId);
    respond({ success: true, data: { started: true } });
    work(body, emitEvent).catch((err) => {
      console.log('[interfaz_remota] Error en pseudoendpoint streaming:', err.message);
      emitEvent('interfaz-remota:message:event', {
        chatSessionId: sessionId,
        sessionId,
        kind: 'message',
        type: 'error',
        error: err.message ? err.message : 'Error interno del pseudoendpoint',
      });
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
      auth: { token, unique_id: announceId },
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
    hub.setBroadcaster((evt) => {
      if (socket && socket.connected) {
        try {
          socket.emit('interfaz-remota:componentes:event', evt);
        } catch (err) {
          console.log('[interfaz_remota] error al emitir componentes:event:', err.message);
        }
      }
    });
    emitAnnounce();
    scheduleAnnounce();
    scheduleTokenRenewal();
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

  socket.on('connect_error', async (err) => {
    wsState.connected = false;
    wsState.error = err.message ? err.message : 'Error socket.io.';
    wsState.message = 'Error en la conexión socket.io.';
    console.log('[interfaz_remota] socket.io connect_error:', err.message);
    fileLog(`CONNECT_ERROR ${err.message}`);
    // Si el token caducó (o la autenticación falló), renovarlo de inmediato y
    // reconectar con el token fresco. No esperamos el backoff de socket.io con un
    // token inválido, que reintentaría para siempre sin progreso.
    if (isAuthError(err)) {
      console.log('[interfaz_remota] Error de autenticación detectado, renovando token y reconectando...');
      try {
        const { token } = await relogin();
        loginState.token = token;
        loginState.success = true;
        updateSocketAuth(token);
        forceReconnect();
      } catch (reloginErr) {
        console.log('[interfaz_remota] re-login tras unauthorized falló:', reloginErr.message);
        fileLog(`TOKEN_RENEW error=${reloginErr.message}`);
      }
    }
  });

  socket.on('desarrollo:status', (payload) => {
    console.log('[interfaz_remota] desarrollo:status recibido:', JSON.stringify(payload).slice(0, 120));
  });

  socket.on('interfaz-remota:chatSessions', (payload, ack) => {
    const cb = typeof ack === 'function' ? ack : (typeof payload === 'function' ? payload : null);
    fileLog(`EVENT interfaz-remota:chatSessions recibido, ack=${typeof ack}, payloadIsFn=${typeof payload}`);
    handleChatSessionsRequest(cb);
  });

  const emitRemoto = (event, payload) => {
    if (socket && socket.connected) {
      socket.emit(event, payload);
    }
  };

  socket.on('interfaz-remota:getMessages', makeRemotaHandler((body) => getChatMessagesCached(body)));
  socket.on('interfaz-remota:sendMessage', makeStreamingHandler((body, emit) => sendChatMessageStreaming(body, emit), emitRemoto));
  socket.on('interfaz-remota:sendCommand', makeStreamingHandler((body, emit) => executeChatCommandStreaming(body, emit), emitRemoto));
  socket.on('interfaz-remota:crearSesion', makeRemotaHandler((body) => createChatSession(body)));
  socket.on('interfaz-remota:listComandos', makeRemotaHandler((body) => listComandosPersonalizados(body)));
  socket.on('interfaz-remota:ejecutarComando', makeStreamingHandler((body, emit) => ejecutarComandoPersonalizadoRemotoStreaming(body, emit), emitRemoto));

  socket.on('interfaz-remota:terminal:create', makeRemotaHandler((body) => {
    console.log('[interfaz_remota] terminal:create recibido:', JSON.stringify({ chatSessionId: body.chatSessionId, cwd: body.cwd, cmd: body.cmd ? '(set)' : null }));
    const t0 = Date.now();
    const resp = createRemoteTerminal({ ...body, emit: emitRemoto });
    console.log(`[interfaz_remota] terminal:create respondido en ${Date.now() - t0} ms:`, JSON.stringify(resp).slice(0, 160));
    return resp;
  }));
  socket.on('interfaz-remota:terminal:input', makeRemotaHandler((body) => writeRemoteTerminal(body)));
  socket.on('interfaz-remota:terminal:resize', makeRemotaHandler((body) => resizeRemoteTerminal(body)));
  socket.on('interfaz-remota:terminal:close', makeRemotaHandler((body) => closeRemoteTerminal(body)));
  socket.on('interfaz-remota:terminal:list', makeRemotaHandler((body) => listRemoteTerminals(body)));

  // Prompt del agente OpenCode por socket (streaming vía interfaz-remota:opencode:event)
  socket.on('interfaz-remota:opencode:send', makeRemotaHandler((body) => runOpencodePromptSocket(body, emitRemoto)));
  // Confirmación de controles interactivos del agente OpenCode (permisos, forms, etc.)
  // Componentes en ejecución (terminales puenteadas + agentes opencode) con historial+en vivo
  socket.on('interfaz-remota:componentes:list', makeRemotaHandler((body) => listComponentes(body)));
  socket.on('interfaz-remota:componentes:input', makeRemotaHandler((body) => componentInput(body)));
  socket.on('interfaz-remota:componentes:resize', makeRemotaHandler((body) => componentResize(body)));
  socket.on('interfaz-remota:componentes:stop', makeRemotaHandler((body) => stopComponentesSession(body)));
  socket.on('interfaz-remota:sendControl', makeRemotaHandler((body) => handleSendControl(body)));

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
  if (tokenRenewTimer) {
    clearTimeout(tokenRenewTimer);
    tokenRenewTimer = null;
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
  remotaQueues.clear();
  chatSessionsCache = { at: 0, data: null };
  messagesCache.clear();
}

// Reutilizable: obtiene credenciales, hace login y devuelve el token fresco sin
// tocar el socket. Lo usan el login inicial, el watchdog de renovación proactiva
// y la re-autenticación ante errores `unauthorized`.
async function relogin() {
  const creds = await getGestionCredentials(1);
  if (!creds) {
    throw new Error('Gestión interna no configurada. Configure gestion_url, gestion_api_user y gestion_api_password.');
  }
  const result = await login(creds.gestionUrl, creds.username, creds.password);
  return { url: creds.gestionUrl, token: result.token, requestLog: result.requestLog };
}

// Aplica un token nuevo a las futuras conexiones del Manager de socket.io. No
// reinicia el socket actual: solo asegura que las próximas reconexiones usen el
// token fresco en vez del caducado.
function updateSocketAuth(token) {
  if (socket && socket.io && socket.io.opts) {
    socket.io.opts.auth = { token, unique_id: announceId };
  }
}

// Detecta errores de conexión causados por autenticación (token caducado/inválido)
// para renovar el token y reconectar, en vez de dejar que socket.io reintente con
// un token inservible.
function isAuthError(err) {
  const msg = String((err && (err.message || err.type)) || '').toLowerCase();
  return msg.includes('unauthorized') || msg.includes('token') || msg.includes('autenticación');
}

// Fuerza una reconexión inmediata con la autenticación ya actualizada. Se usa tras
// renovar el token ante un `unauthorized`, para no esperar el backoff de socket.io.
function forceReconnect() {
  if (!socket) return;
  try {
    if (socket.connected) {
      socket.disconnect();
    }
    socket.connect();
  } catch (err) {
    console.log('[interfaz_remota] error al forzar reconexión:', err.message);
  }
}

// Renueva el token proactivamente antes de que expire y lo deja listo para las
// próximas reconexiones. Mientras el socket siga conectado no se interrumpe la
// sesión: solo se re-anuncia para mantener el registro en la gestión interna.
async function renewToken() {
  try {
    const { url, token } = await relogin();
    loginState.token = token;
    loginState.url = url;
    loginState.success = true;
    updateSocketAuth(token);
    emitAnnounce();
    console.log('[interfaz_remota] token renovado (renovación proactiva).');
    fileLog(`TOKEN_RENEW ok url=${url}`);
  } catch (err) {
    loginState.success = false;
    loginState.message = err.message ? err.message : 'Error al renovar token de gestión interna.';
    console.log('[interfaz_remota] Error al renovar token:', err.message);
    fileLog(`TOKEN_RENEW error=${err.message}`);
  }
}

// Programa la renovación periódica del token (~7h) de forma recursiva para no
// solapar ejecuciones si `renewToken` tardase más de lo esperado.
function scheduleTokenRenewal() {
  if (!enabled || !socket) return;
  if (tokenRenewTimer) {
    clearTimeout(tokenRenewTimer);
  }
  tokenRenewTimer = setTimeout(() => {
    renewToken().finally(() => {
      // Solo reprogramamos si la conexión sigue habilitada y con socket vivo (p. ej.
      // un `disable`/`stop` durante un `renewToken` en vuelo no debe reactivarla).
      if (enabled && socket) scheduleTokenRenewal();
    });
  }, TOKEN_RENEW_INTERVAL_MS);
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
    const { url, token, requestLog } = await relogin();
    loginState.configured = true;
    loginState.success = true;
    loginState.url = url;
    loginState.token = token;
    loginState.requestLog = requestLog;
    loginState.message = 'Login exitoso en gestión interna.';
    console.log('[interfaz_remota] Login exitoso en gestión interna.');

    connectInterfazRemotaWs(url, token);
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
