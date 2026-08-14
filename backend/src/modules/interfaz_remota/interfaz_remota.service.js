import WebSocket from 'ws';
import { login, getGestionCredentials } from '../gestion/gestion.service.js';

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
};

let ws = null;
let wsReconnectTimer = null;

function resetWsState() {
  wsState = {
    attempted: true,
    connected: false,
    url: null,
    message: 'Sin conexión WebSocket.',
    error: null,
    connectedAt: null,
    lastCheckAt: new Date().toISOString(),
  };
}

export function connectInterfazRemotaWs(gestionUrl) {
  if (ws && (ws.readyState === WebSocket.OPEN || ws.readyState === WebSocket.CONNECTING)) {
    return;
  }

  if (wsReconnectTimer) {
    clearTimeout(wsReconnectTimer);
    wsReconnectTimer = null;
  }

  const baseUrl = gestionUrl.replace(/\/+$/, '');
  const isHttps = baseUrl.startsWith('https:');
  const wsUrl = `${isHttps ? 'wss' : 'ws'}://${baseUrl.replace(/^https?:\/\//, '')}/socket.io/?EIO=4&transport=websocket`;

  resetWsState();
  wsState.url = wsUrl;

  let opened = false;
  try {
    ws = new WebSocket(wsUrl, { rejectUnauthorized: true });
  } catch (err) {
    wsState.error = err.message ? err.message : 'Error al crear conexión WebSocket.';
    wsState.message = 'Error al conectar WebSocket.';
    console.log('[interfaz_remota] Error al crear WebSocket:', err.message);
    scheduleWsRetry();
    return;
  }

  const openTimeout = setTimeout(() => {
    if (!opened) {
      wsState.error = 'Timeout de conexión WebSocket.';
      wsState.message = 'No se pudo conectar el WebSocket.';
      console.log('[interfaz_remota] WebSocket timeout');
      try { ws.terminate(); } catch (err) { console.log('[interfaz_remota] error al terminar ws:', err.message); }
    }
  }, 8000);

  ws.on('open', () => {
    opened = true;
    clearTimeout(openTimeout);
    wsState.connected = true;
    wsState.connectedAt = new Date().toISOString();
    wsState.message = 'WebSocket conectado al servicio de gestión interna.';
    wsState.error = null;
    console.log('[interfaz_remota] WebSocket conectado:', wsUrl);
  });

  ws.on('message', (data) => {
    console.log('[interfaz_remota] WebSocket message:', data.toString().slice(0, 80));
  });

  ws.on('close', (code, reason) => {
    clearTimeout(openTimeout);
    const wasConnected = wsState.connected;
    wsState.connected = false;
    wsState.connectedAt = null;
    wsState.message = 'Conexión WebSocket cerrada.';
    console.log(`[interfaz_remota] WebSocket cerrado (code ${code})${reason ? ': ' + reason : ''}`);
    if (wasConnected || opened) {
      scheduleWsRetry();
    }
  });

  ws.on('error', (err) => {
    clearTimeout(openTimeout);
    wsState.connected = false;
    wsState.error = err.message ? err.message : 'Error WebSocket.';
    wsState.message = 'Error en la conexión WebSocket.';
    console.log('[interfaz_remota] Error WebSocket:', err.message || err.code);
  });
}

function scheduleWsRetry() {
  if (wsReconnectTimer) {
    clearTimeout(wsReconnectTimer);
  }
  wsReconnectTimer = setTimeout(() => {
    if (loginState.configured && loginState.url) {
      connectInterfazRemotaWs(loginState.url);
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
  if (ws) {
    try {
      ws.removeAllListeners();
      ws.terminate();
    } catch (err) {
      console.log('[interfaz_remota] error al cerrar WebSocket:', err.message);
    }
    ws = null;
  }
  wsState = {
    attempted: false,
    connected: false,
    url: null,
    message: null,
    error: null,
    connectedAt: null,
    lastCheckAt: null,
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

    connectInterfazRemotaWs(creds.gestionUrl);
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

export function getInterfazRemotaStatus() {
  return {
    login: loginState,
    ws: wsState,
  };
}
