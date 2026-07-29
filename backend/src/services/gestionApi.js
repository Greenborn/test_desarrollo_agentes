import { decrypt } from './crypto.js';
import dbConfig from '../config/dbConfig.js';

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
    console.log(`[gestionApi] ${label}: respuesta no-JSON (status ${res.status}): ${snippet}`);
    throw Object.assign(new Error(`El servidor respondió con HTML en vez de JSON (status ${res.status}): ${snippet}`), { requestLog });
  }
  return data;
}

export async function login(gestionUrl, username, password) {
  const url = `${gestionUrl.replace(/\/+$/, '')}/api/auth/login`;
  const { response: res, requestLog } = await apiRequest('POST', url, { 'Content-Type': 'application/json' }, JSON.stringify({ username, password }));
  const data = await parseJsonOrThrow(res, requestLog, 'login');
  if (!data.status || !data.data?.token) {
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
    console.log('[gestionApi] Error al desencriptar credenciales:', err.message);
    return null;
  }
}
