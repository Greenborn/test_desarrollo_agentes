import db from '../config/db.js';
import memoriaClient from './memoriaClient.js';

// Preferencias de UI por sesión de chat (pestaña activa del panel inferior y
// del panel derecho, estado desplegado/colapsado de ambos, etc.).
//
// Fuente de verdad: columna `prefs` de `chat_sessions` (persistencia).
// Caché: servicio api_memoria (namespace `session_prefs`), escritura
// write-through en cada guardado y lectura memoria-first.
const NAMESPACE = 'session_prefs';
const TTL = 86400;

function cacheKey(sessionId) {
  return `session_${sessionId}`;
}

export function parsePrefs(raw) {
  if (!raw) return {};
  if (typeof raw === 'object') return raw;
  try {
    const parsed = JSON.parse(raw);
    return parsed && typeof parsed === 'object' ? parsed : {};
  } catch (err) {
    console.log('[sessionPrefs] Error al parsear prefs:', err.message);
    return {};
  }
}

async function cacheSet(sessionId, userId, prefs) {
  try {
    await memoriaClient.set(NAMESPACE, cacheKey(sessionId), { userId, prefs }, TTL);
    return true;
  } catch (err) {
    console.log('[sessionPrefs] Error al escribir caché de prefs:', err.message);
    return false;
  }
}

async function cacheGet(sessionId) {
  try {
    const data = await memoriaClient.get(NAMESPACE, cacheKey(sessionId));
    if (!data || !data.value || typeof data.value !== 'object') return null;
    const { userId, prefs } = data.value;
    if (!userId) return null;
    return { userId, prefs: parsePrefs(prefs) };
  } catch (err) {
    console.log('[sessionPrefs] Error al leer caché de prefs:', err.message);
    return null;
  }
}

export async function invalidateSessionPrefs(sessionId) {
  try {
    await memoriaClient.del(NAMESPACE, cacheKey(sessionId));
  } catch (err) {
    console.log('[sessionPrefs] Error al invalidar caché de prefs:', err.message);
  }
}

// Devuelve { found, prefs, cached }. `found` es false si la sesión no existe o
// no pertenece al usuario.
export async function getSessionPrefs(sessionId, userId) {
  const cached = await cacheGet(sessionId);
  if (cached) {
    if (Number(cached.userId) !== Number(userId)) {
      return { found: false, prefs: {}, cached: true };
    }
    return { found: true, prefs: cached.prefs, cached: true };
  }

  const row = await db('chat_sessions')
    .where({ id: sessionId, user_id: userId })
    .first('id', 'user_id', 'prefs');
  if (!row) return { found: false, prefs: {}, cached: false };

  const prefs = parsePrefs(row.prefs);
  await cacheSet(sessionId, row.user_id, prefs);
  return { found: true, prefs, cached: false };
}

// Persiste las prefs completas de la sesión en BD y refresca la caché.
// No toca `updated_at`: son preferencias de UI, no actividad de la sesión, y
// el listado de sesiones se ordena por ese campo.
export async function setSessionPrefs(sessionId, userId, prefs) {
  const value = prefs && typeof prefs === 'object' ? prefs : null;
  const updated = await db('chat_sessions')
    .where({ id: sessionId, user_id: userId })
    .update({ prefs: value ? JSON.stringify(value) : null });
  if (!updated) return { found: false };

  const cached = await cacheSet(sessionId, userId, value || {});
  if (!cached) await invalidateSessionPrefs(sessionId);

  return { found: true, prefs: value || {} };
}

// Mezcla un subconjunto de claves sobre las prefs existentes.
export async function mergeSessionPrefs(sessionId, userId, patch) {
  if (!patch || typeof patch !== 'object') {
    return { found: false, error: 'patch debe ser un objeto' };
  }
  const current = await getSessionPrefs(sessionId, userId);
  if (!current.found) return { found: false };
  return setSessionPrefs(sessionId, userId, { ...current.prefs, ...patch });
}

export default {
  parsePrefs,
  getSessionPrefs,
  setSessionPrefs,
  mergeSessionPrefs,
  invalidateSessionPrefs,
};
