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

// Este módulo reúne los pseudoendpoints de "interfaz remota" que dependen del estado
// propio del backend principal (DB de chat, streaming DeepSeek, comandos personalizados,
// opencode, componentHub/terminalBridge compartidos con la UI local). Se invocan vía
// HTTP desde el servicio `interfaz_remota` (puerto SERVICIO_INTERFAZ_REMOTA_PORT), que es
// quien mantiene la conexión socket.io con la gestión interna y retransmite hacia aquí
// (ver interfazRemotaBridge.routes.js). Lo que SÍ es autocontenible (conexión/login,
// terminales remotas PTY, almacenamiento compartido) vive en ese servicio aparte.

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

// Serializa las peticiones de sesiones de chat. Evita que múltiples llamadas
// concurrentes (reintentos del lado gestión interna, usuarios, etc.) lancen
// consultas DB duplicadas simultáneas que bloquean el event loop.
let chatSessionQueue = Promise.resolve();

export function handleChatSessionsRequest(ack) {
  const respond = (payload) => {
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
  try {
    for await (const chunk of streamChat(history, wsId)) {
      if (chunk.type === 'usage') continue;
      if (chunk.type === 'thinking') {
        fullThinking += chunk.content;
      } else {
        fullResponse += chunk.content;
      }
    }
  } catch (err) {
    console.log('[interfaz_remota] Error en stream de chat (sendChatMessage):', err.message);
    return { success: false, error: 'Error en el proveedor de chat: ' + err.message };
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

// Variante streaming de sendMessage: ACK inmediato (vía makeStreamingHandler) y el
// progreso (thinking/response/done/error) se emite por `interfaz-remota:message:event`.
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

// Variante streaming de executeChatCommand: ACK inmediato (vía makeStreamingHandler) y
// el resultado se entrega por `interfaz-remota:message:event`.
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

// Variante streaming de ejecutarComandoPersonalizadoRemoto: ACK inmediato (vía
// makeStreamingHandler) y el resultado se entrega por `interfaz-remota:message:event`.
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
      comandoId,
      type: 'done',
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

  try { terminalBridge.ensureSession(sessionId); } catch (err) {
    console.log('[interfaz_remota] error al iniciar bridge de terminales:', err.message);
  }

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

export function componentInput({ sessionId, terminalId, data } = {}) {
  if (!terminalId) return { success: false, error: 'terminalId requerido' };
  if (data === null || data === undefined) return { success: false, error: 'data requerido' };
  return terminalBridge.sendInput(sessionId, terminalId, data);
}

export function componentResize({ sessionId, terminalId, cols, rows } = {}) {
  if (!terminalId) return { success: false, error: 'terminalId requerido' };
  return terminalBridge.resize(sessionId, terminalId, cols, rows);
}

export function stopComponentesSession({ sessionId } = {}) {
  if (sessionId) terminalBridge.stopSession(sessionId);
  return { success: true };
}

// Confirma un control interactivo de OpenCode (permisos) emitido por el socket.
export function handleSendControl(body = {}) {
  const controlId = body?.controlId;
  if (!controlId) return { success: false, error: 'controlId requerido' };
  const value = body?.value;
  const response = value === 'no' ? 'no' : 'yes';
  controlEmitter.emit(`control-${controlId}`, { response, remember: false });
  return { success: true, data: { ok: true } };
}

// Lanza un prompt hacia el agente OpenCode y emite el streaming (terminal, thinking,
// response, control, done, error) como eventos `interfaz-remota:opencode:event`.
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

// Adaptador de pseudoendpoint "request/response": serializa por sesión y responde el
// resultado tal cual (se usa tanto desde las rutas internas como, antes, desde sockets).
export function makeRemotaHandler(work) {
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

// Adaptador de pseudoendpoint "streaming": ACK inmediato con `{ started: true }` y la
// respuesta/progreso se entrega después por eventos vía `emit`. Evita que operaciones
// largas (chat, comandos, opencode) mantengan en vuelo un ACK y bloqueen la cola.
export function makeStreamingHandler(work, emit) {
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
