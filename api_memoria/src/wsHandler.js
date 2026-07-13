import {
  setValue,
  getValue,
  delValue,
  keysValue,
  clearNamespace,
  expireValue,
} from './services/memoriaStore.js';

const API_KEY = process.env.MEMORIA_API_KEY;

function send(ws, payload) {
  if (ws.readyState === 1) {
    ws.send(JSON.stringify(payload));
  }
}

function sendError(ws, id, message) {
  send(ws, { id, type: 'error', error: message });
}

function handleMessage(ws, raw) {
  let msg;
  try {
    msg = JSON.parse(raw);
  } catch (err) {
    console.log('[memoria-ws] Error al parsear mensaje JSON:', err.message);
    return sendError(ws, null, 'Mensaje JSON inválido');
  }

  const { id, type, namespace, key, value, ttl } = msg;

  if (!type) {
    return sendError(ws, id, 'type es requerido');
  }

  try {
    switch (type) {
      case 'auth': {
        const token = msg.token;
        if (!token || token !== API_KEY) {
          return sendError(ws, id, 'API key inválida');
        }
        ws.authenticated = true;
        return send(ws, { id, type: 'auth_result', success: true });
      }

      case 'set': {
        if (!namespace || !key) {
          return sendError(ws, id, 'namespace y key son requeridos');
        }
        const result = setValue(namespace, key, value, ttl);
        return send(ws, { id, type: 'set_result', ...result });
      }

      case 'get': {
        if (!namespace || !key) {
          return sendError(ws, id, 'namespace y key son requeridos');
        }
        const val = getValue(namespace, key);
        if (val === null) {
          return sendError(ws, id, 'Key no encontrada o expirada');
        }
        return send(ws, { id, type: 'get_result', namespace, key, value: val });
      }

      case 'del': {
        if (!namespace || !key) {
          return sendError(ws, id, 'namespace y key son requeridos');
        }
        const removed = delValue(namespace, key);
        if (!removed) {
          return sendError(ws, id, 'Key no encontrada');
        }
        return send(ws, { id, type: 'del_result', success: true });
      }

      case 'keys': {
        if (!namespace) {
          return sendError(ws, id, 'namespace es requerido');
        }
        const keys = keysValue(namespace);
        return send(ws, { id, type: 'keys_result', namespace, keys });
      }

      case 'clear': {
        if (!namespace) {
          return sendError(ws, id, 'namespace es requerido');
        }
        clearNamespace(namespace);
        return send(ws, { id, type: 'clear_result', success: true });
      }

      case 'expire': {
        if (!namespace || !key) {
          return sendError(ws, id, 'namespace y key son requeridos');
        }
        if (typeof ttl !== 'number' || ttl <= 0) {
          return sendError(ws, id, 'ttl (segundos) es requerido y debe ser > 0');
        }
        const expiresAt = expireValue(namespace, key, ttl);
        if (expiresAt === null) {
          return sendError(ws, id, 'Key no encontrada');
        }
        return send(ws, { id, type: 'expire_result', success: true, namespace, key, expiresAt });
      }

      case 'health': {
        return send(ws, { id, type: 'health_result', status: 'ok' });
      }

      default:
        return sendError(ws, id, `Tipo de mensaje desconocido: ${type}`);
    }
  } catch (err) {
    console.log('[memoria-ws] Error procesando mensaje:', err.message);
    return sendError(ws, id, err.message);
  }
}

export default function setupWebSocket(wss) {
  wss.on('connection', (ws, req) => {
    console.log('[memoria-ws] Cliente conectado');

    ws.authenticated = false;

    ws.on('message', (raw) => {
      if (!ws.authenticated) {
        let msg;
        try {
          msg = JSON.parse(raw);
        } catch (err) {
          console.log('[memoria-ws] Error al parsear mensaje auth:', err.message);
          return sendError(ws, null, 'Mensaje JSON inválido');
        }

        if (msg.type !== 'auth') {
          return sendError(ws, msg.id, 'Debe autenticarse primero con un mensaje type=auth');
        }

        const token = msg.token;
        if (!token || token !== API_KEY) {
          return sendError(ws, msg.id, 'API key inválida');
        }

        ws.authenticated = true;
        return send(ws, { id: msg.id, type: 'auth_result', success: true });
      }

      handleMessage(ws, raw);
    });

    ws.on('close', () => {
      console.log('[memoria-ws] Cliente desconectado');
    });

    ws.on('error', (err) => {
      console.log('[memoria-ws] Error en conexión:', err.message);
    });
  });
}
