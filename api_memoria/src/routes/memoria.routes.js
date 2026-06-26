import { Router } from 'express';

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

const router = Router();

router.get('/health', (req, res) => {
  res.json({ status: 'ok' });
});

router.post('/set', (req, res) => {
  try {
    const { namespace, key, value, ttl } = req.body;

    if (!namespace || !key) {
      return res.status(400).json({ error: 'namespace y key son requeridos' });
    }

    const map = getNamespace(namespace);
    const entry = { value };

    if (typeof ttl === 'number' && ttl > 0) {
      entry.expiresAt = Date.now() + ttl * 1000;
    }

    map.set(key, entry);

    res.json({ success: true, namespace, key });
  } catch (err) {
    console.log('[memoria] Error en set:', err.message);
    res.status(500).json({ error: err.message });
  }
});

router.get('/get/:namespace/:key', (req, res) => {
  try {
    const { namespace, key } = req.params;
    const map = store.get(namespace);

    if (!map) {
      return res.status(404).json({ error: 'Namespace no encontrado' });
    }

    const entry = map.get(key);
    if (!entry) {
      return res.status(404).json({ error: 'Key no encontrada' });
    }

    if (entry.expiresAt && entry.expiresAt <= Date.now()) {
      map.delete(key);
      return res.status(404).json({ error: 'Key expirada' });
    }

    res.json({ namespace, key, value: entry.value });
  } catch (err) {
    console.log('[memoria] Error en get:', err.message);
    res.status(500).json({ error: err.message });
  }
});

router.delete('/del/:namespace/:key', (req, res) => {
  try {
    const { namespace, key } = req.params;
    const map = store.get(namespace);

    if (!map || !map.has(key)) {
      return res.status(404).json({ error: 'Key no encontrada' });
    }

    map.delete(key);

    if (map.size === 0) {
      store.delete(namespace);
    }

    res.json({ success: true });
  } catch (err) {
    console.log('[memoria] Error en del:', err.message);
    res.status(500).json({ error: err.message });
  }
});

router.get('/keys/:namespace', (req, res) => {
  try {
    const { namespace } = req.params;
    const map = store.get(namespace);

    if (!map) {
      return res.json({ namespace, keys: [] });
    }

    const now = Date.now();
    const keys = [];

    for (const [key, entry] of map) {
      if (entry.expiresAt && entry.expiresAt <= now) {
        map.delete(key);
        continue;
      }
      keys.push(key);
    }

    if (map.size === 0) {
      store.delete(namespace);
    }

    res.json({ namespace, keys });
  } catch (err) {
    console.log('[memoria] Error en keys:', err.message);
    res.status(500).json({ error: err.message });
  }
});

router.delete('/clear/:namespace', (req, res) => {
  try {
    const { namespace } = req.params;
    store.delete(namespace);
    res.json({ success: true });
  } catch (err) {
    console.log('[memoria] Error en clear:', err.message);
    res.status(500).json({ error: err.message });
  }
});

router.post('/expire/:namespace/:key', (req, res) => {
  try {
    const { namespace, key } = req.params;
    const { ttl } = req.body;

    if (typeof ttl !== 'number' || ttl <= 0) {
      return res.status(400).json({ error: 'ttl (segundos) es requerido y debe ser > 0' });
    }

    const map = store.get(namespace);
    if (!map || !map.has(key)) {
      return res.status(404).json({ error: 'Key no encontrada' });
    }

    const entry = map.get(key);
    entry.expiresAt = Date.now() + ttl * 1000;

    res.json({ success: true, namespace, key, expiresAt: entry.expiresAt });
  } catch (err) {
    console.log('[memoria] Error en expire:', err.message);
    res.status(500).json({ error: err.message });
  }
});

export default router;
