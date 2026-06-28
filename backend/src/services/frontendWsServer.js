import { WebSocketServer } from 'ws';
import crypto from 'crypto';
import bcrypt from 'bcrypt';
import db from '../config/db.js';
import memoriaClient from './memoriaClient.js';
import opencode from './opencode.js';

const COOKIE_NAME = 'session_token';
const SESSION_TTL = 86400;
const NAMESPACE = 'session';

let msgIdCounter = 0;

function getNextId() {
  msgIdCounter += 1;
  return `fws_${msgIdCounter}`;
}

function parseCookies(cookieHeader) {
  const cookies = {};
  if (!cookieHeader) return cookies;
  cookieHeader.split(';').forEach(pair => {
    const idx = pair.indexOf('=');
    if (idx === -1) return;
    const key = pair.slice(0, idx).trim();
    if (key) cookies[key] = decodeURIComponent(pair.slice(idx + 1).trim());
  });
  return cookies;
}

async function getSessionFromToken(token) {
  if (!token) return null;
  try {
    const data = await memoriaClient.get(NAMESPACE, token);
    if (data && data.value) {
      return { ...data.value, _token: token };
    }
  } catch (err) {
    console.log('[frontendWs] Error al cargar sesión:', err.message);
  }
  return null;
}

async function saveSession(token, sessionData) {
  const dataToSave = {};
  for (const key of Object.keys(sessionData)) {
    if (!key.startsWith('_')) {
      dataToSave[key] = sessionData[key];
    }
  }
  await memoriaClient.set(NAMESPACE, token, dataToSave, SESSION_TTL);
}

async function handleMemoriaGet(payload) {
  const { namespace, key } = payload;
  if (!namespace) return { type: 'error', error: 'namespace requerido' };
  const data = await memoriaClient.get(namespace, key);
  return { type: 'memoria_get_result', success: true, value: data?.value ?? null };
}

async function handleMemoriaSet(payload) {
  const { namespace, key, value, ttl } = payload;
  if (!namespace || !key) return { type: 'error', error: 'namespace y key requeridos' };
  await memoriaClient.set(namespace, key, value, ttl);
  return { type: 'memoria_set_result', success: true };
}

async function handleMemoriaDel(payload) {
  const { namespace, key } = payload;
  if (!namespace || !key) return { type: 'error', error: 'namespace y key requeridos' };
  await memoriaClient.del(namespace, key);
  return { type: 'memoria_del_result', success: true };
}

async function handleMemoriaKeys(payload) {
  const { namespace } = payload;
  if (!namespace) return { type: 'error', error: 'namespace requerido' };
  const result = await memoriaClient.keys(namespace);
  return { type: 'memoria_keys_result', success: true, keys: result.keys || [] };
}

async function handleSettingSet(payload, cookieToken) {
  const token = payload.sessionToken || cookieToken;
  if (!token) return { type: 'error', error: 'Sesión no válida' };
  const session = await getSessionFromToken(token);
  if (!session || !session.userId) return { type: 'error', error: 'Sesión no válida' };

  const { key, value } = payload;
  if (!key) return { type: 'error', error: 'key requerido' };
  if (value === undefined || value === null) return { type: 'error', error: 'value requerido' };

  await db('user_settings')
    .insert({ user_id: session.userId, key, value: String(value) })
    .onConflict(['user_id', 'key'])
    .merge();

  return { type: 'setting_set_result', success: true };
}

async function handleSettingGet(payload, cookieToken) {
  const token = payload.sessionToken || cookieToken;
  if (!token) return { type: 'error', error: 'Sesión no válida' };
  const session = await getSessionFromToken(token);
  if (!session || !session.userId) return { type: 'error', error: 'Sesión no válida' };

  const { key } = payload;
  if (!key) return { type: 'error', error: 'key requerido' };

  const row = await db('user_settings')
    .where({ user_id: session.userId, key })
    .first();

  return { type: 'setting_get_result', success: true, value: row ? row.value : null };
}

async function handleProyectoVarListar(payload) {
  const { sessionToken } = payload;
  if (!sessionToken) return { type: 'error', error: 'Sesión no válida' };
  const session = await getSessionFromToken(sessionToken);
  if (!session || !session.userId) return { type: 'error', error: 'Sesión no válida' };

  const proyectoId = payload.proyectoId;
  if (!proyectoId) return { type: 'error', error: 'proyectoId requerido' };

  const wsIds = session.workspaceIds || [1];
  const proyecto = await db('proyectos').select('id').where({ id: proyectoId }).whereIn('workspace_id', wsIds).first();
  if (!proyecto) return { type: 'error', error: 'Proyecto no encontrado' };

  const dbVariables = await db('project_variables')
    .select('key', 'value', 'type', 'created_at', 'updated_at')
    .where({ proyecto_id: proyectoId })
    .orderBy('key');

  const variables = [];
  const memoryNamespace = `proyecto:${proyectoId}`;

  for (const v of dbVariables) {
    if (v.type === 'memory') {
      try {
        const memResult = await memoriaClient.get(memoryNamespace, v.key);
        variables.push({ key: v.key, value: memResult.value, type: 'memory', created_at: v.created_at, updated_at: v.updated_at });
      } catch {
        variables.push({ key: v.key, value: '', type: 'memory', created_at: v.created_at, updated_at: v.updated_at });
      }
    } else {
      variables.push({ key: v.key, value: v.value, type: 'db', created_at: v.created_at, updated_at: v.updated_at });
    }
  }

  try {
    const memKeysResult = await memoriaClient.keys(memoryNamespace);
    if (memKeysResult.keys && memKeysResult.keys.length > 0) {
      const existingDbKeys = new Set(dbVariables.map(v => v.key));
      for (const memKey of memKeysResult.keys) {
        if (!existingDbKeys.has(memKey)) {
          try {
            const memResult = await memoriaClient.get(memoryNamespace, memKey);
            variables.push({ key: memKey, value: memResult.value, type: 'memory', created_at: null, updated_at: null });
          } catch {
            variables.push({ key: memKey, value: '', type: 'memory', created_at: null, updated_at: null });
          }
        }
      }
    }
  } catch (err) {
    console.log('[frontendWs] Error al obtener keys de memoria:', err.message);
  }

  return { type: 'proyecto_var_listar_result', success: true, variables };
}

async function handleProyectoVarCrear(payload) {
  const { sessionToken } = payload;
  if (!sessionToken) return { type: 'error', error: 'Sesión no válida' };
  const session = await getSessionFromToken(sessionToken);
  if (!session || !session.userId) return { type: 'error', error: 'Sesión no válida' };

  const { proyectoId, key, value, type } = payload;
  if (!proyectoId) return { type: 'error', error: 'proyectoId requerido' };
  if (!key) return { type: 'error', error: 'key requerido' };
  if (value === undefined || value === null) return { type: 'error', error: 'value requerido' };

  const varType = type === 'memory' ? 'memory' : 'db';
  const wsIds = session.workspaceIds || [1];
  const proyecto = await db('proyectos').select('id').where({ id: proyectoId }).whereIn('workspace_id', wsIds).first();
  if (!proyecto) return { type: 'error', error: 'Proyecto no encontrado' };

  const existing = await db('project_variables').where({ proyecto_id: proyectoId, key }).first();
  if (existing) return { type: 'error', error: `La variable "${key}" ya existe en este proyecto` };

  if (varType === 'memory') {
    await db('project_variables').insert({ proyecto_id: proyectoId, key, value: '', type: 'memory' });
    await memoriaClient.set(`proyecto:${proyectoId}`, key, value);
  } else {
    await db('project_variables').insert({ proyecto_id: proyectoId, key, value: String(value), type: 'db' });
  }

  return { type: 'proyecto_var_crear_result', success: true };
}

async function handleProyectoVarActualizar(payload) {
  const { sessionToken } = payload;
  if (!sessionToken) return { type: 'error', error: 'Sesión no válida' };
  const session = await getSessionFromToken(sessionToken);
  if (!session || !session.userId) return { type: 'error', error: 'Sesión no válida' };

  const { proyectoId, key, value } = payload;
  if (!proyectoId) return { type: 'error', error: 'proyectoId requerido' };
  if (!key) return { type: 'error', error: 'key requerido' };
  if (value === undefined || value === null) return { type: 'error', error: 'value requerido' };

  const wsIds = session.workspaceIds || [1];
  const proyecto = await db('proyectos').select('id').where({ id: proyectoId }).whereIn('workspace_id', wsIds).first();
  if (!proyecto) return { type: 'error', error: 'Proyecto no encontrado' };

  const existing = await db('project_variables').select('type').where({ proyecto_id: proyectoId, key }).first();
  if (!existing) return { type: 'error', error: `Variable "${key}" no encontrada` };

  if (existing.type === 'memory') {
    await memoriaClient.set(`proyecto:${proyectoId}`, key, value);
  } else {
    await db('project_variables').where({ proyecto_id: proyectoId, key }).update({ value: String(value), updated_at: db.fn.now() });
  }

  return { type: 'proyecto_var_actualizar_result', success: true };
}

async function handleProyectoVarEliminar(payload) {
  const { sessionToken } = payload;
  if (!sessionToken) return { type: 'error', error: 'Sesión no válida' };
  const session = await getSessionFromToken(sessionToken);
  if (!session || !session.userId) return { type: 'error', error: 'Sesión no válida' };

  const { proyectoId, key } = payload;
  if (!proyectoId) return { type: 'error', error: 'proyectoId requerido' };
  if (!key) return { type: 'error', error: 'key requerido' };

  const wsIds = session.workspaceIds || [1];
  const proyecto = await db('proyectos').select('id').where({ id: proyectoId }).whereIn('workspace_id', wsIds).first();
  if (!proyecto) return { type: 'error', error: 'Proyecto no encontrado' };

  const existing = await db('project_variables').select('type').where({ proyecto_id: proyectoId, key }).first();
  if (!existing) return { type: 'error', error: `Variable "${key}" no encontrada` };

  if (existing.type === 'memory') {
    try { await memoriaClient.del(`proyecto:${proyectoId}`, key); } catch (err) {
      console.log('[frontendWs] Error al eliminar variable de memoria:', err.message);
    }
  }
  await db('project_variables').where({ proyecto_id: proyectoId, key }).delete();

  return { type: 'proyecto_var_eliminar_result', success: true };
}

async function handleLogin(payload) {
  const { username, password } = payload;
  if (!username || !password) {
    return { type: 'error', error: 'Credenciales inválidas' };
  }

  const users = await db('users').where({ username });
  if (!users.length) {
    return { type: 'login_result', success: false, error: 'Credenciales inválidas' };
  }

  const user = users[0];
  const match = await bcrypt.compare(password, user.password_hash);
  if (!match) {
    return { type: 'login_result', success: false, error: 'Credenciales inválidas' };
  }

  const userWs = await db('user_settings').where({ user_id: user.id, key: 'selected_workspace_id' }).first();
  let wsIds = [1];
  if (userWs) {
    try {
      const parsed = JSON.parse(userWs.value);
      wsIds = Array.isArray(parsed) ? parsed : [parseInt(userWs.value, 10) || 1];
    } catch {
      wsIds = [parseInt(userWs.value, 10) || 1];
    }
  }

  const sessionToken = crypto.randomUUID();
  const sessionData = {
    userId: user.id,
    username: user.username,
    role: user.role,
    workspaceIds: wsIds,
  };

  await saveSession(sessionToken, sessionData);

  return {
    type: 'login_result',
    success: true,
    user: { id: user.id, username: user.username, role: user.role, workspaceIds: wsIds },
    sessionToken,
  };
}

async function handleCheckSession(payload, cookieToken) {
  const token = payload.sessionToken || cookieToken;
  if (!token) {
    return { type: 'checkSession_result', success: false, user: null };
  }

  const session = await getSessionFromToken(token);
  if (!session || !session.userId) {
    return { type: 'checkSession_result', success: false, user: null };
  }

  return {
    type: 'checkSession_result',
    success: true,
    sessionToken: token,
    user: {
      id: session.userId,
      username: session.username,
      role: session.role,
      workspaceIds: session.workspaceIds || [1],
    },
  };
}

async function handleLogout(payload, cookieToken) {
  const token = payload.sessionToken || cookieToken;
  if (token) {
    try {
      await memoriaClient.del(NAMESPACE, token);
    } catch (err) {
      console.log('[frontendWs] Error al destruir sesión:', err.message);
    }
  }
  return { type: 'logout_result', success: true };
}

async function handleSelectWorkspaces(payload, cookieToken) {
  const token = payload.sessionToken || cookieToken;
  if (!token) {
    return { type: 'error', error: 'Sesión no válida' };
  }

  const session = await getSessionFromToken(token);
  if (!session || !session.userId) {
    return { type: 'error', error: 'Sesión no válida' };
  }

  const { workspaceIds } = payload;
  if (!Array.isArray(workspaceIds) || workspaceIds.length === 0) {
    return { type: 'error', error: 'workspaceIds debe ser un array no vacío' };
  }

  const existingIds = new Set((await db('workspaces').select('id')).map(w => w.id));
  const invalid = workspaceIds.filter(id => !existingIds.has(id));
  if (invalid.length > 0) {
    return { type: 'error', error: `Workspaces no encontrados: ${invalid.join(', ')}` };
  }

  const oldIds = session.workspaceIds || [1];
  const removed = oldIds.filter(id => !workspaceIds.includes(id));

  if (removed.length > 0) {
    const PW_URL = `http://localhost:${process.env.SERVICIO_PLAYWRIGHT_PORT || 4098}`;
    try {
      opencode.stopAllServers();
    } catch (e) {
      console.log('[frontendWs] error al detener opencode:', e.message);
    }
    try {
      await fetch(`${PW_URL}/api/command`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ comando: 'close_all' }),
      });
    } catch (e) {
      console.log('[frontendWs] error al cerrar navegadores:', e.message);
    }
  }

  session.workspaceIds = workspaceIds;
  await saveSession(token, session);

  await db('user_settings')
    .insert({ user_id: session.userId, key: 'selected_workspace_id', value: JSON.stringify(workspaceIds) })
    .onConflict(['user_id', 'key'])
    .merge();

  return { type: 'selectWorkspaces_result', success: true, workspaceIds };
}

export function setupFrontendWebSocket(server) {
  const wss = new WebSocketServer({ server, path: '/ws' });

  wss.on('connection', (ws, req) => {
    const cookies = parseCookies(req.headers.cookie);
    const cookieToken = cookies[COOKIE_NAME] || null;

    console.log(`[frontendWs] Cliente conectado${cookieToken ? ' (con cookie de sesión)' : ''}`);

    ws.on('message', async (raw) => {
      let msg;
      try {
        msg = JSON.parse(raw);
      } catch {
        ws.send(JSON.stringify({ id: null, type: 'error', error: 'JSON inválido' }));
        return;
      }

      const { id, type, ...payload } = msg;
      const responseId = id || getNextId();

      try {
        let result;
        switch (type) {
          case 'login':
            result = await handleLogin(payload);
            break;
          case 'checkSession':
            result = await handleCheckSession(payload, cookieToken);
            break;
          case 'logout':
            result = await handleLogout(payload, cookieToken);
            break;
          case 'selectWorkspaces':
            result = await handleSelectWorkspaces(payload, cookieToken);
            break;
          case 'memoria:get':
            result = await handleMemoriaGet(payload);
            break;
          case 'memoria:set':
            result = await handleMemoriaSet(payload);
            break;
          case 'memoria:del':
            result = await handleMemoriaDel(payload);
            break;
          case 'memoria:keys':
            result = await handleMemoriaKeys(payload);
            break;
          case 'setting:set':
            result = await handleSettingSet(payload, cookieToken);
            break;
          case 'setting:get':
            result = await handleSettingGet(payload, cookieToken);
            break;
          case 'proyectoVarListar':
            result = await handleProyectoVarListar(payload);
            break;
          case 'proyectoVarCrear':
            result = await handleProyectoVarCrear(payload);
            break;
          case 'proyectoVarActualizar':
            result = await handleProyectoVarActualizar(payload);
            break;
          case 'proyectoVarEliminar':
            result = await handleProyectoVarEliminar(payload);
            break;
          default:
            ws.send(JSON.stringify({ id: responseId, type: 'error', error: 'Tipo de mensaje desconocido' }));
            return;
        }
        ws.send(JSON.stringify({ id: responseId, ...result }));
      } catch (err) {
        console.log('[frontendWs] Error procesando mensaje:', err.message);
        ws.send(JSON.stringify({ id: responseId, type: 'error', error: err.message }));
      }
    });

    ws.on('close', () => {
      console.log('[frontendWs] Cliente desconectado');
    });

    ws.on('error', (err) => {
      console.log('[frontendWs] Error en conexión:', err.message);
    });
  });

  console.log('[frontendWs] WebSocket server ready on /ws');
}
