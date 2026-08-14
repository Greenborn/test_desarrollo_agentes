import { io } from 'socket.io-client';
import { login, getGestionCredentials } from '../gestion/gestion.service.js';

const ANNOUNCE_INTERVAL_MS = 45000;

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
      transports: ['websocket'],
      auth: { token },
      reconnection: true,
      reconnectionDelay: 5000,
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
    emitAnnounce();
    scheduleAnnounce();
  });

  socket.on('disconnect', (reason) => {
    wsState.connected = false;
    wsState.connectedAt = null;
    wsState.announce = null;
    wsState.message = `Conexión socket.io cerrada (${reason}).`;
    console.log('[interfaz_remota] socket.io desconectado:', reason);
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
  });

  socket.on('desarrollo:status', (payload) => {
    console.log('[interfaz_remota] desarrollo:status recibido:', JSON.stringify(payload).slice(0, 120));
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
  };
}
