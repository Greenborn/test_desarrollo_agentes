import WebSocket from 'ws';

const MEMORIA_PORT = process.env.SERVICIO_MEMORIA_PORT || 4101;
const API_KEY = process.env.MEMORIA_API_KEY;
const WS_URL = `ws://localhost:${MEMORIA_PORT}/api/memoria`;

let ws = null;
let msgIdCounter = 0;
const pending = new Map();
let connecting = false;
let connectCallbacks = [];
let reconnectTimer = null;

function getNextId() {
  msgIdCounter += 1;
  return `mem_${msgIdCounter}`;
}

function cleanupPending(errorMsg) {
  for (const [id, { reject }] of pending) {
    reject(new Error(errorMsg));
    pending.delete(id);
  }
}

function flushConnectCallbacks(err) {
  connecting = false;
  const cbs = connectCallbacks;
  connectCallbacks = [];
  for (const cb of cbs) {
    if (err) cb.reject(err);
    else cb.resolve();
  }
}

function connect() {
  if (ws && (ws.readyState === WebSocket.OPEN || ws.readyState === WebSocket.CONNECTING)) {
    return Promise.resolve();
  }

  if (connecting) {
    return new Promise((resolve, reject) => {
      connectCallbacks.push({ resolve, reject });
    });
  }

  connecting = true;

  return new Promise((resolve, reject) => {
    connectCallbacks.push({ resolve, reject });

    try {
      ws = new WebSocket(WS_URL);
    } catch (err) {
      flushConnectCallbacks(err);
      return;
    }

    ws.on('open', () => {
      ws.send(JSON.stringify({ id: getNextId(), type: 'auth', token: API_KEY }));
    });

    ws.on('message', (raw) => {
      let msg;
      try {
        msg = JSON.parse(raw);
      } catch (parseErr) {
        console.log('[memoriaClient] mensaje no JSON recibido:', parseErr.message);
        return;
      }

      if (msg.type === 'auth_result') {
        if (msg.error) {
          console.log('[memoriaClient] Error de autenticación:', msg.error);
          flushConnectCallbacks(new Error(msg.error));
          return;
        }
        flushConnectCallbacks(null);
        return;
      }

      const id = msg.id;
      if (id && pending.has(id)) {
        const entry = pending.get(id);
        pending.delete(id);
        if (msg.type === 'error') {
          entry.reject(new Error(msg.error));
        } else {
          entry.resolve(msg);
        }
      }
    });

    ws.on('close', () => {
      console.log('[memoriaClient] WebSocket desconectado, reintentando en 1s');
      ws = null;
      connecting = false;
      flushConnectCallbacks(new Error('Conexión WebSocket cerrada'));
      cleanupPending('Conexión WebSocket cerrada');

      if (reconnectTimer) clearTimeout(reconnectTimer);
      reconnectTimer = setTimeout(() => { connect(); }, 1000);
    });

    ws.on('error', (err) => {
      if (err.message || err.code) {
        console.log('[memoriaClient] Error WebSocket:', err.message || err.code);
      }
    });
  });
}

async function request(type, payload = {}) {
  await connect();

  const id = getNextId();
  const msg = JSON.stringify({ id, type, ...payload });

  return new Promise((resolve, reject) => {
    pending.set(id, { resolve, reject });

    try {
      ws.send(msg);
    } catch (err) {
      pending.delete(id);
      reject(err);
    }
  });
}

const client = {
  async set(namespace, key, value, ttl) {
    return request('set', { namespace, key, value, ttl });
  },

  async get(namespace, key) {
    try {
      const result = await request('get', { namespace, key });
      return result;
    } catch (err) {
      if (err.message && (err.message.includes('no encontrada') || err.message.includes('expirada'))) {
        return null;
      }
      throw err;
    }
  },

  async del(namespace, key) {
    return request('del', { namespace, key });
  },

  async keys(namespace) {
    return request('keys', { namespace });
  },

  async clear(namespace) {
    return request('clear', { namespace });
  },

  async expire(namespace, key, ttl) {
    return request('expire', { namespace, key, ttl });
  },

  async health() {
    try {
      await connect();
      return !!(ws && ws.readyState === WebSocket.OPEN);
    } catch (healthErr) {
      console.log('[memoriaClient] health check falló:', healthErr.message);
      return false;
    }
  },
};

connect().catch((bootErr) => {
  console.log('[memoriaClient] conexión inicial falló:', bootErr.message);
});

export default client;
