// Component Hub central: rastrea los componentes en ejecución de cada sesión de chat
// (terminales y agentes opencode) independientemente de qué sistema los haya iniciado.
//
// - Registro global por chatSessionId con un buffer de historial acotado.
// - pushEvent() acumula el historial y notifica a los suscriptores locales + a un
//   broadcaster externo (la interfaz remota SGI), para que cualquier consumidor pueda
//   recibir historial + en vivo.
//
// El broadcaster lo fija el consumidor externo (interfaz_remota.service.js) llamando
// a setBroadcaster(). Los eventos broadcast llevan la forma:
//   { componentId, chatSessionId, kind, ts, type, ...rest }

const components = new Map(); // componentId -> record
const bySession = new Map(); // chatSessionId -> Set<componentId>

let broadcaster = null;

const MAX_BUFFER = 200;

function genComponentId(kind, sessionId) {
  const n = (bySession.get(sessionId)?.size || 0) + 1;
  return `${kind}-${sessionId}-${Date.now().toString(36)}-${n}-${Math.random().toString(36).slice(2, 6)}`;
}

function notifyLocal(record, evt) {
  for (const cb of record.subscribers) {
    try {
      cb(evt);
    } catch (err) {
      console.log('[componentHub] error en suscriptor local:', err.message);
    }
  }
}

function broadcast(evt) {
  if (typeof broadcaster === 'function') {
    try {
      broadcaster(evt);
    } catch (err) {
      console.log('[componentHub] error en broadcaster:', err.message);
    }
  }
}

export function setBroadcaster(fn) {
  broadcaster = fn;
}

export function getComponent(componentId) {
  return components.get(componentId) || null;
}

// Registra un componente nuevo. Devuelve el record.
export function register({ componentId = null, kind = 'generic', sessionId, label = '', meta = {} }) {
  const id = componentId || genComponentId(kind, sessionId);
  const record = {
    componentId: id,
    kind,
    chatSessionId: sessionId,
    label,
    meta,
    status: 'running',
    buffer: [],
    subscribers: new Set(),
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  };
  components.set(id, record);
  if (!bySession.has(sessionId)) bySession.set(sessionId, new Set());
  bySession.get(sessionId).add(id);
  const evt = {
    componentId: id,
    chatSessionId: sessionId,
    kind,
    label,
    meta,
    status: 'running',
    type: 'registered',
    ts: record.createdAt,
  };
  broadcast(evt);
  return record;
}

// Acumula un evento en el historial y lo propaga (suscriptores + broadcaster).
export function pushEvent(componentId, evt = {}) {
  const record = components.get(componentId);
  if (!record) return null;
  record.updatedAt = new Date().toISOString();
  const entry = {
    ...evt,
    componentId,
    chatSessionId: record.chatSessionId,
    kind: record.kind,
    ts: new Date().toISOString(),
  };
  record.buffer.push(entry);
  if (record.buffer.length > MAX_BUFFER) {
    record.buffer = record.buffer.slice(record.buffer.length - MAX_BUFFER);
  }
  notifyLocal(record, entry);
  broadcast(entry);
  return entry;
}

// Finaliza un componente (exited/done/error) manteniendo su historial.
export function finalize(componentId, { status = 'done', evt = {} } = {}) {
  const record = components.get(componentId);
  if (!record) return null;
  record.status = status;
  record.updatedAt = new Date().toISOString();
  const entry = {
    ...evt,
    componentId,
    chatSessionId: record.chatSessionId,
    kind: record.kind,
    type: evt.type || status,
    status,
    ts: new Date().toISOString(),
  };
  record.buffer.push(entry);
  if (record.buffer.length > MAX_BUFFER) {
    record.buffer = record.buffer.slice(record.buffer.length - MAX_BUFFER);
  }
  notifyLocal(record, entry);
  broadcast(entry);
  return entry;
}

// Elimina un componente del registro (sin conservar historial).
export function unregister(componentId) {
  const record = components.get(componentId);
  if (!record) return;
  components.delete(componentId);
  const set = bySession.get(record.chatSessionId);
  if (set) set.delete(componentId);
  for (const cb of record.subscribers) {
    try {
      cb({ ...record, type: 'unregistered' });
    } catch (err) {
      console.log('[componentHub] error al notificar unregister:', err.message);
    }
  }
}

// Suscriptor local: recibe el historial inmediatamente y luego los eventos en vivo.
export function subscribe(componentId, cb) {
  const record = components.get(componentId);
  if (!record) {
    return () => {};
  }
  for (const entry of record.buffer) {
    try { cb(entry); } catch (err) { console.log('[componentHub] error replay:', err.message); }
  }
  record.subscribers.add(cb);
  return () => record.subscribers.delete(cb);
}

// Lista los componentes (con su historial y estado) de una sesión.
export function listBySession(sessionId) {
  const ids = (sessionId && bySession.get(sessionId)) || new Set();
  const out = [];
  for (const id of ids) {
    const r = components.get(id);
    if (r) {
      out.push({
        componentId: r.componentId,
        kind: r.kind,
        chatSessionId: r.chatSessionId,
        label: r.label,
        meta: r.meta,
        status: r.status,
        createdAt: r.createdAt,
        updatedAt: r.updatedAt,
        buffer: r.buffer,
      });
    }
  }
  return out;
}

export function getStatus() {
  return {
    total: components.size,
    bySession: Array.from(bySession.entries()).map(([k, v]) => ({ sessionId: k, count: v.size })),
  };
}

export default {
  setBroadcaster,
  getComponent,
  register,
  pushEvent,
  finalize,
  unregister,
  subscribe,
  listBySession,
  getStatus,
};
