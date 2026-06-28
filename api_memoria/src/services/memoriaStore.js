const store = new Map();
const TTL_CHECK_INTERVAL = 30000;

function getNamespace(ns) {
  if (!store.has(ns)) {
    store.set(ns, new Map());
  }
  return store.get(ns);
}

function purgeExpired() {
  const now = Date.now();
  for (const [ns, map] of store) {
    for (const [key, entry] of map) {
      if (entry.expiresAt && entry.expiresAt <= now) {
        map.delete(key);
      }
    }
    if (map.size === 0) {
      store.delete(ns);
    }
  }
}

setInterval(purgeExpired, TTL_CHECK_INTERVAL);

export function setValue(namespace, key, value, ttl) {
  const map = getNamespace(namespace);
  const entry = { value };
  if (typeof ttl === 'number' && ttl > 0) {
    entry.expiresAt = Date.now() + ttl * 1000;
  }
  map.set(key, entry);
  return { success: true, namespace, key };
}

export function getValue(namespace, key) {
  const map = store.get(namespace);
  if (!map) return null;
  const entry = map.get(key);
  if (!entry) return null;
  if (entry.expiresAt && entry.expiresAt <= Date.now()) {
    map.delete(key);
    if (map.size === 0) store.delete(namespace);
    return null;
  }
  return entry.value;
}

export function delValue(namespace, key) {
  const map = store.get(namespace);
  if (!map || !map.has(key)) return false;
  map.delete(key);
  if (map.size === 0) store.delete(namespace);
  return true;
}

export function keysValue(namespace) {
  const map = store.get(namespace);
  if (!map) return [];
  const now = Date.now();
  const keys = [];
  for (const [key, entry] of map) {
    if (entry.expiresAt && entry.expiresAt <= now) {
      map.delete(key);
      continue;
    }
    keys.push(key);
  }
  if (map.size === 0) store.delete(namespace);
  return keys;
}

export function clearNamespace(namespace) {
  store.delete(namespace);
  return true;
}

export function expireValue(namespace, key, ttl) {
  const map = store.get(namespace);
  if (!map || !map.has(key)) return null;
  const entry = map.get(key);
  entry.expiresAt = Date.now() + ttl * 1000;
  return entry.expiresAt;
}
