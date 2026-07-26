import path from 'path';
import { fileURLToPath } from 'url';
import Database from 'better-sqlite3';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

const dbPath = path.resolve(__dirname, '../../../data/memoria.db');

const db = new Database(dbPath);

db.exec(`
  CREATE TABLE IF NOT EXISTS memoria (
    namespace TEXT NOT NULL,
    key TEXT NOT NULL,
    value TEXT NOT NULL,
    expires_at INTEGER,
    PRIMARY KEY (namespace, key)
  )
`);

const TTL_CHECK_INTERVAL = 30000;

function purgeExpired() {
  const now = Date.now();
  const { changes } = db.prepare('DELETE FROM memoria WHERE expires_at IS NOT NULL AND expires_at <= ?').run(now);
  if (changes > 0) {
    console.log(`[memoriaStore] Purgadas ${changes} entradas expiradas`);
  }
}

setInterval(purgeExpired, TTL_CHECK_INTERVAL);

export function setValue(namespace, key, value, ttl) {
  const expiresAt = typeof ttl === 'number' && ttl > 0 ? Date.now() + ttl * 1000 : null;
  const serialized = JSON.stringify(value);

  db.prepare(`
    INSERT INTO memoria (namespace, key, value, expires_at)
    VALUES (?, ?, ?, ?)
    ON CONFLICT(namespace, key) DO UPDATE SET
      value = excluded.value,
      expires_at = excluded.expires_at
  `).run(namespace, key, serialized, expiresAt);

  return { success: true, namespace, key };
}

export function getValue(namespace, key) {
  const row = db.prepare('SELECT value, expires_at FROM memoria WHERE namespace = ? AND key = ?').get(namespace, key);
  if (!row) return null;

  if (row.expires_at && row.expires_at <= Date.now()) {
    db.prepare('DELETE FROM memoria WHERE namespace = ? AND key = ?').run(namespace, key);
    return null;
  }

  try {
    return JSON.parse(row.value);
  } catch {
    return row.value;
  }
}

export function delValue(namespace, key) {
  const { changes } = db.prepare('DELETE FROM memoria WHERE namespace = ? AND key = ?').run(namespace, key);
  return changes > 0;
}

export function keysValue(namespace) {
  const now = Date.now();

  db.prepare('DELETE FROM memoria WHERE namespace = ? AND expires_at IS NOT NULL AND expires_at <= ?').run(namespace, now);

  const rows = db.prepare('SELECT key FROM memoria WHERE namespace = ? ORDER BY key').all(namespace);
  return rows.map(r => r.key);
}

export function clearNamespace(namespace) {
  db.prepare('DELETE FROM memoria WHERE namespace = ?').run(namespace);
  return true;
}

export function expireValue(namespace, key, ttl) {
  const row = db.prepare('SELECT 1 FROM memoria WHERE namespace = ? AND key = ?').get(namespace, key);
  if (!row) return null;

  const expiresAt = Date.now() + ttl * 1000;
  db.prepare('UPDATE memoria SET expires_at = ? WHERE namespace = ? AND key = ?').run(expiresAt, namespace, key);
  return expiresAt;
}
