import crypto from 'crypto';
import path from 'path';
import { fileURLToPath } from 'url';
import knex from 'knex';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const projectDir = path.resolve(__dirname, '../..');

// Conexión propia a la DB de configuración (mismo archivo que usa el backend principal,
// igual que hace api_gastos con su propia conexión knex a un .db compartido).
const dbConfigPath = process.env.DB_CONFIG_SQLITE_PATH
  ? path.resolve(projectDir, 'backend', process.env.DB_CONFIG_SQLITE_PATH)
  : path.resolve(projectDir, 'data/config.db');

const dbConfig = knex({
  client: 'better-sqlite3',
  connection: { filename: dbConfigPath },
  useNullAsDefault: true,
});

const ALGORITHM = 'aes-256-cbc';

function getKey() {
  const raw = process.env.ENCRYPTION_KEY;
  if (!raw) {
    throw new Error('ENCRYPTION_KEY no está definida en .env');
  }
  return crypto.createHash('sha256').update(raw).digest();
}

function decrypt(encryptedText) {
  const key = getKey();
  const parts = encryptedText.split(':');
  const iv = Buffer.from(parts[0], 'hex');
  const encrypted = Buffer.from(parts[1], 'hex');
  const decipher = crypto.createDecipheriv(ALGORITHM, key, iv);
  return decipher.update(encrypted) + decipher.final('utf8');
}

const REQUEST_TIMEOUT_MS = 15000;

export async function login(gestionUrl, username, password) {
  const url = `${gestionUrl.replace(/\/+$/, '')}/api/auth/login`;
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);
  let res;
  try {
    res = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ username, password }),
      signal: controller.signal,
    });
  } catch (err) {
    clearTimeout(timeoutId);
    if (err.name === 'AbortError') {
      throw Object.assign(new Error(`Tiempo de espera agotado al conectar con gestión interna (${REQUEST_TIMEOUT_MS}ms)`), { requestLog: { method: 'POST', url } });
    }
    throw err;
  }
  clearTimeout(timeoutId);
  const requestLog = { method: 'POST', url, statusCode: res.status };
  const text = await res.text();
  let data;
  try {
    data = JSON.parse(text);
  } catch (err) {
    const snippet = text.length > 200 ? text.slice(0, 200) + '...' : text;
    throw Object.assign(new Error(`El servidor respondió con HTML en vez de JSON (status ${res.status}): ${snippet}`), { requestLog });
  }
  const ok = data.status === true || data.success === true;
  if (!ok || !data.data?.token) {
    const errMsg = data.error || 'Error al autenticar en gestión interna';
    throw Object.assign(new Error(errMsg), { requestLog });
  }
  return { token: data.data.token, requestLog };
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
    console.log('[interfaz_remota] Error al desencriptar credenciales:', err.message);
    return null;
  }
}
