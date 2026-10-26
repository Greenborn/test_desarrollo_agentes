import { io } from 'socket.io-client';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { login, getGestionCredentials } from './gestionAuth.js';
import { callBackend } from './bridgeClient.js';
import {
  listarAlmacenamiento,
  subirAlmacenamientoIniciar,
  subirAlmacenamientoChunk,
  subirAlmacenamientoFinalizar,
  subirAlmacenamientoCancelar,
} from './almacenamiento.js';
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
// Mismo margen que usaba el backend principal: el token del login SGI tiene TTL de 24h,
// se renueva cada ~7h para no quedar nunca fuera por expiración.
const TOKEN_RENEW_INTERVAL_MS = 7 * 60 * 60 * 1000;
const IO_LOG_MAX = 200;
// Tope de longitud para el payload guardado en el log io. Las subidas por chunks llevan
// cientos de KB en base64 por evento: serializarlas completas (en memoria, por SSE y en
// el DOM del log) bloquea el event loop y provoca ping timeouts durante la transferencia.
const IO_LOG_PAYLOAD_MAX_CHARS = 4000;
const FILE_LOG_PATH = path.resolve(__dirname, '../logs/interfaz_remota.log');

function fileLog(msg) {
  try {
    fs.mkdirSync(path.dirname(FILE_LOG_PATH), { recursive: true });
    fs.appendFileSync(FILE_LOG_PATH, `[${new Date().toISOString()}] ${msg}\n`);
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

// Resumen de una parte de subida: nunca se guarda el contenido (base64/binario).
function resumirChunk(data) {
  const body = Array.isArray(data) ? data[0] : data;
  if (!body || typeof body !== 'object') return data;
  let bytes = null;
  if (typeof body.base64 === 'string') {
    bytes = Math.round((body.base64.length * 3) / 4);
  } else if (body.chunk && typeof body.chunk.byteLength === 'number') {
    bytes = body.chunk.byteLength;
  } else if (body.chunk && typeof body.chunk.length === 'number') {
    bytes = body.chunk.length;
  }
  return { uploadId: body.uploadId, index: body.index, offset: body.offset, bytes };
}

function sanitizeLogData(event, data) {
  if (event === 'interfaz-remota:almacenamiento:subir:chunk') return resumirChunk(data);
  return data;
}

function appendIoLog(direction, event, data) {
  ioLogIdCounter += 1;
  const resumido = sanitizeLogData(event, data);
  const serializado = safeSerialize(resumido) || '';
  let payload = null;
  if (serializado.length > IO_LOG_PAYLOAD_MAX_CHARS) {
    payload = {
      truncado: true,
      longitud: serializado.length,
      preview: serializado.slice(0, IO_LOG_PAYLOAD_MAX_CHARS),
    };
  } else {
    try {
      payload = JSON.parse(serializado);
    } catch (err) {
      payload = String(resumido);
    }
  }
  const entry = { id: ioLogIdCounter, ts: new Date().toISOString(), direction, event, data: payload };
  ioLog.push(entry);
  if (ioLog.length > IO_LOG_MAX) {
    ioLog = ioLog.slice(ioLog.length - IO_LOG_MAX);
  }
  broadcastIoLog(entry);
  console.log(`[interfaz_remota] io ${direction} "${event}":`, serializado.slice(0, 200));
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

// Adaptador genérico de pseudoendpoints request/response: reenvía al backend principal
// y responde el ACK con lo que éste devuelva.
function proxyHandler(backendPath) {
  return (payload, ack) => {
    const respond = (resp) => {
      if (typeof ack === 'function') ack(resp);
    };
    callBackend(backendPath, payload && typeof payload === 'object' ? payload : {})
      .then(respond)
      .catch((err) => {
        console.log(`[interfaz_remota] Error al retransmitir ${backendPath} al backend:`, err.message);
        respond({ success: false, error: 'Error al comunicarse con el backend principal' });
      });
  };
}

// Adaptador de pseudoendpoints locales (síncronos o async, no dependen del backend
// principal): terminales remotas y almacenamiento compartido.
function localHandler(work) {
  return (payload, ack) => {
    const respond = (resp) => {
      if (typeof ack === 'function') ack(resp);
    };
    const body = payload && typeof payload === 'object' ? payload : {};
    Promise.resolve()
      .then(() => work(body))
      .then(respond)
      .catch((err) => {
        console.log('[interfaz_remota] Error en pseudoendpoint local:', err.message);
        respond({ success: false, error: err.message ? err.message : 'Error interno del pseudoendpoint' });
      });
  };
}

function emitAnnounce() {
  if (!socket || !socket.connected) {
    console.log('[interfaz_remota] No se puede anunciar: socket no conectado.');
    return;
  }
  socket.emit('desarrollo:announce', { id: announceId, nombre: announceNombre, detalles: announceDetalles }, (resp) => {
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
  if (announceTimer) clearInterval(announceTimer);
  announceTimer = setInterval(() => emitAnnounce(), ANNOUNCE_INTERVAL_MS);
}

export function connectInterfazRemotaWs(gestionUrl, token) {
  if (!enabled) {
    console.log('[interfaz_remota] Conexión deshabilitada, no se conecta.');
    return;
  }
  if (socket) return;

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

  // Sesiones de chat, comandos personalizados, opencode y componentes dependen del
  // estado propio del backend principal (DB, streaming, hubs compartidos con la UI
  // local): se retransmiten por HTTP.
  socket.on('interfaz-remota:chatSessions', proxyHandler('/chat-sessions'));
  socket.on('interfaz-remota:getMessages', proxyHandler('/get-messages'));
  socket.on('interfaz-remota:sendMessage', proxyHandler('/send-message'));
  socket.on('interfaz-remota:sendCommand', proxyHandler('/send-command'));
  socket.on('interfaz-remota:crearSesion', proxyHandler('/crear-sesion'));
  socket.on('interfaz-remota:listComandos', proxyHandler('/list-comandos'));
  socket.on('interfaz-remota:ejecutarComando', proxyHandler('/ejecutar-comando'));
  socket.on('interfaz-remota:opencode:send', proxyHandler('/opencode-send'));
  socket.on('interfaz-remota:sendControl', proxyHandler('/send-control'));
  socket.on('interfaz-remota:componentes:list', proxyHandler('/componentes-list'));
  socket.on('interfaz-remota:componentes:input', proxyHandler('/componentes-input'));
  socket.on('interfaz-remota:componentes:resize', proxyHandler('/componentes-resize'));
  socket.on('interfaz-remota:componentes:stop', proxyHandler('/componentes-stop'));

  const emitRemoto = (event, payload) => {
    if (socket && socket.connected) socket.emit(event, payload);
  };

  // Terminales remotas (PTY propias de este servicio, sin dependencia del backend).
  socket.on('interfaz-remota:terminal:create', localHandler((body) => createRemoteTerminal({ ...body, emit: emitRemoto })));
  socket.on('interfaz-remota:terminal:input', localHandler((body) => writeRemoteTerminal(body)));
  socket.on('interfaz-remota:terminal:resize', localHandler((body) => resizeRemoteTerminal(body)));
  socket.on('interfaz-remota:terminal:close', localHandler((body) => closeRemoteTerminal(body)));
  socket.on('interfaz-remota:terminal:list', localHandler((body) => listRemoteTerminals(body)));

  // Almacenamiento compartido (navegación y subida por chunks), filesystem propio.
  socket.on('interfaz-remota:almacenamiento:listar', localHandler((body) => listarAlmacenamiento(body)));
  socket.on('interfaz-remota:almacenamiento:subir:iniciar', localHandler((body) => subirAlmacenamientoIniciar(body)));
  socket.on('interfaz-remota:almacenamiento:subir:chunk', localHandler((body) => subirAlmacenamientoChunk(body)));
  socket.on('interfaz-remota:almacenamiento:subir:finalizar', localHandler((body) => subirAlmacenamientoFinalizar(body)));
  socket.on('interfaz-remota:almacenamiento:subir:cancelar', localHandler((body) => subirAlmacenamientoCancelar(body)));

  socket.onAny((event, ...args) => {
    // Los eventos con ACK llegan como (payload, callback). Se descarta el callback para
    // que el log guarde el payload real y no `[payload, null]`.
    const sinAck = args.length > 1 && typeof args[args.length - 1] === 'function' ? args.slice(0, -1) : args;
    appendIoLog('in', event, sinAck.length === 1 ? sinAck[0] : sinAck);
  });

  socket.onAnyOutgoing((event, ...args) => {
    const sinAck = args.length > 1 && typeof args[args.length - 1] === 'function' ? args.slice(0, -1) : args;
    appendIoLog('out', event, sinAck.length === 1 ? sinAck[0] : sinAck);
  });
}

function scheduleWsRetry() {
  if (wsReconnectTimer) clearTimeout(wsReconnectTimer);
  wsReconnectTimer = setTimeout(() => {
    if (loginState.configured && loginState.url && loginState.token) {
      connectInterfazRemotaWs(loginState.url, loginState.token);
    }
  }, 5000);
}

export function getInterfazRemotaWsState() {
  return wsState;
}

// Usado por la ruta /internal/relay: el backend principal empuja hacia aquí los eventos
// de streaming (mensajes de chat, opencode, componentes) para que se reenvíen por el
// socket hacia la gestión interna, igual que antes hacía `emitRemoto` directo.
export function emitIfConnected(event, payload) {
  if (socket && socket.connected) {
    socket.emit(event, payload);
    return true;
  }
  return false;
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
}

async function relogin() {
  const creds = await getGestionCredentials(1);
  if (!creds) {
    throw new Error('Gestión interna no configurada. Configure gestion_url, gestion_api_user y gestion_api_password.');
  }
  const result = await login(creds.gestionUrl, creds.username, creds.password);
  return { url: creds.gestionUrl, token: result.token, requestLog: result.requestLog };
}

function updateSocketAuth(token) {
  if (socket && socket.io && socket.io.opts) {
    socket.io.opts.auth = { token, unique_id: announceId };
  }
}

function isAuthError(err) {
  const msg = String((err && (err.message || err.type)) || '').toLowerCase();
  return msg.includes('unauthorized') || msg.includes('token') || msg.includes('autenticación');
}

function forceReconnect() {
  if (!socket) return;
  try {
    if (socket.connected) socket.disconnect();
    socket.connect();
  } catch (err) {
    console.log('[interfaz_remota] error al forzar reconexión:', err.message);
  }
}

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

function scheduleTokenRenewal() {
  if (!enabled || !socket) return;
  if (tokenRenewTimer) clearTimeout(tokenRenewTimer);
  tokenRenewTimer = setTimeout(() => {
    renewToken().finally(() => {
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

// Fuerza un reinicio completo de la conexión (login + socket.io), aunque ya esté
// habilitada: cierra el socket actual (si quedó colgado) y reintenta desde cero. A
// diferencia de enable/disable, no depende de que el usuario la haya deshabilitado antes.
export function reconnectInterfazRemota() {
  enabled = true;
  stopInterfazRemotaWs();
  return initInterfazRemotaLogin();
}

export function getInterfazRemotaStatus() {
  return { enabled, login: loginState, ws: wsState, ioLog };
}
