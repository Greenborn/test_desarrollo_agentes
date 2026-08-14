import { decrypt } from '../../services/crypto.js';
import dbConfig from '../../config/dbConfig.js';

async function apiRequest(method, url, headers, body) {
  const res = await fetch(url, { method, headers, body });
  const requestLog = { method, url, statusCode: res.status };
  return { response: res, requestLog };
}

async function parseJsonOrThrow(res, requestLog, label) {
  const text = await res.text();
  let data;
  try {
    data = JSON.parse(text);
  } catch (parseErr) {
    const snippet = text.length > 200 ? text.slice(0, 200) + '...' : text;
    console.log(`[gestion] ${label}: respuesta no-JSON (status ${res.status}): ${snippet}`);
    throw Object.assign(new Error(`El servidor respondió con HTML en vez de JSON (status ${res.status}): ${snippet}`), { requestLog });
  }
  return data;
}

export async function login(gestionUrl, username, password) {
  const url = `${gestionUrl.replace(/\/+$/, '')}/api/auth/login`;
  const { response: res, requestLog } = await apiRequest('POST', url, { 'Content-Type': 'application/json' }, JSON.stringify({ username, password }));
  const data = await parseJsonOrThrow(res, requestLog, 'login');
  const ok = data.status === true || data.success === true;
  if (!ok || !data.data?.token) {
    const errMsg = data.error || 'Error al autenticar en gestión interna';
    throw Object.assign(new Error(errMsg), { requestLog });
  }
  return { token: data.data.token, requestLog };
}

export async function uploadFile(gestionUrl, token, nombreOriginal, mimeType, base64) {
  const url = `${gestionUrl.replace(/\/+$/, '')}/api/admin/archivos`;
  const { response: res, requestLog } = await apiRequest('POST', url, {
    'Content-Type': 'application/json',
    'Authorization': `Bearer ${token}`,
  }, JSON.stringify({ nombre_original: nombreOriginal, mime_type: mimeType, base64 }));
  const data = await parseJsonOrThrow(res, requestLog, 'uploadFile');
  if (!data.status) {
    const errMsg = data.error || 'Error al subir archivo a gestión interna';
    throw Object.assign(new Error(errMsg), { requestLog });
  }
  return { data: data.data, requestLog };
}

export async function getGestionCredentials(wsId) {
  const urlRow = await dbConfig('settings').where({ workspace_id: wsId, setting_key: 'gestion_url' }).first();
  if (!urlRow || !urlRow.setting_value) return null;

  const userRow = await dbConfig('settings').where({ workspace_id: wsId, setting_key: 'gestion_api_user' }).first();
  const passRow = await dbConfig('settings').where({ workspace_id: wsId, setting_key: 'gestion_api_password' }).first();

  if (!userRow?.setting_value || !passRow?.setting_value) return null;

  try {
    const username = decrypt(userRow.setting_value);
    const password = decrypt(passRow.setting_value);
    return { gestionUrl: urlRow.setting_value, username, password };
  } catch (err) {
    console.log('[gestion] Error al desencriptar credenciales:', err.message);
    return null;
  }
}

function extractProjectArray(payload) {
  if (Array.isArray(payload)) return payload;
  if (payload && Array.isArray(payload.rows)) return payload.rows;
  if (payload && Array.isArray(payload.data)) return payload.data;
  if (payload && Array.isArray(payload.items)) return payload.items;
  return [];
}

function readableName(slug) {
  return String(slug || '')
    .replace(/_/g, ' ')
    .replace(/\b\w/g, (c) => c.toUpperCase());
}

export async function exportProyecto(wsId, proyecto) {
  const creds = await getGestionCredentials(wsId);
  if (!creds) {
    throw new Error('Gestión interna no configurada. Configure gestion_url, gestion_api_user y gestion_api_password en Settings.');
  }
  const loginResult = await login(creds.gestionUrl, creds.username, creds.password);
  const baseUrl = creds.gestionUrl.replace(/\/+$/, '');

  const slug = proyecto.slug || proyecto.id || '';
  const payload = {
    nombre: proyecto.nombre || readableName(slug),
    slug,
    descripcion: proyecto.descripcion || '',
    color: proyecto.color || '#6b7280',
    workspace_id: proyecto.workspace_id || wsId || 1,
    url_github: proyecto.url_github || null,
    despliegue_config: proyecto.despliegue_config || null,
  };

  const url = `${baseUrl}/api/proyectos`;
  const { response: res, requestLog } = await apiRequest('POST', url, {
    'Content-Type': 'application/json',
    'Authorization': `Bearer ${loginResult.token}`,
  }, JSON.stringify(payload));
  const data = await parseJsonOrThrow(res, requestLog, 'exportProyecto');
  if (!data.status) {
    const errMsg = data.error || 'Error al exportar proyecto a gestión interna';
    throw Object.assign(new Error(errMsg), { requestLog });
  }
  return { data: data.data, requestLog };
}

export async function listProyectos(wsId) {
  const creds = await getGestionCredentials(wsId);
  if (!creds) {
    throw new Error('Gestión interna no configurada. Configure gestion_url, gestion_api_user y gestion_api_password en Settings.');
  }
  const loginResult = await login(creds.gestionUrl, creds.username, creds.password);
  const baseUrl = creds.gestionUrl.replace(/\/+$/, '');

  const proyectos = [];
  let page = 1;
  const pageSize = 100;
  const maxPages = 100;
  let lastPage = null;
  let lastRequestLog = null;

  while (true) {
    const url = `${baseUrl}/api/proyectos?page=${page}&pageSize=${pageSize}&sortField=&sortDir=asc&search=`;
    const { response: res, requestLog } = await apiRequest('GET', url, {
      'Authorization': `Bearer ${loginResult.token}`,
      'Accept': 'application/json',
    });
    lastRequestLog = requestLog;
    const data = await parseJsonOrThrow(res, requestLog, 'listProyectos');

    const wrapper = data && typeof data === 'object' && 'status' in data ? data : { status: true, data };
    if (!wrapper.status) {
      const errMsg = wrapper.error || data.error || 'Error al listar proyectos de gestión interna';
      throw Object.assign(new Error(errMsg), { requestLog });
    }

    const batch = extractProjectArray(wrapper.data);
    proyectos.push(...batch);

    if (lastPage === null) {
      const meta = data?.data ?? {};
      const total = meta.total;
      lastPage = meta.last_page ?? meta.lastPage ?? meta.totalPages ?? (typeof total === 'number' ? Math.ceil(total / pageSize) : 1);
    }

    if (page >= lastPage || batch.length < pageSize || page >= maxPages) break;
    page++;
  }

  return { proyectos, requestLog: lastRequestLog };
}

export async function testConnection(wsId) {
  const creds = await getGestionCredentials(wsId);
  if (!creds) {
    return { success: false, message: 'Gestión interna no configurada. Configure gestion_url, gestion_api_user y gestion_api_password en Settings.' };
  }
  try {
    const result = await login(creds.gestionUrl, creds.username, creds.password);
    return { success: true, message: 'Conexión exitosa al sistema de gestión interna.', requestLog: result.requestLog };
  } catch (err) {
    return { success: false, message: `Error de conexión: ${err.message}`, requestLog: err.requestLog || null };
  }
}
