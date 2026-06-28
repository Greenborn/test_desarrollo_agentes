import { Router } from 'express';
import {
  setValue,
  getValue,
  delValue,
  keysValue,
  clearNamespace,
  expireValue,
} from '../services/memoriaStore.js';

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

    const result = setValue(namespace, key, value, ttl);
    res.json(result);
  } catch (err) {
    console.log('[memoria] Error en set:', err.message);
    res.status(500).json({ error: err.message });
  }
});

router.get('/get/:namespace/:key', (req, res) => {
  try {
    const { namespace, key } = req.params;
    const value = getValue(namespace, key);

    if (value === null) {
      return res.status(404).json({ error: 'Key no encontrada o expirada' });
    }

    res.json({ namespace, key, value });
  } catch (err) {
    console.log('[memoria] Error en get:', err.message);
    res.status(500).json({ error: err.message });
  }
});

router.delete('/del/:namespace/:key', (req, res) => {
  try {
    const { namespace, key } = req.params;
    const removed = delValue(namespace, key);

    if (!removed) {
      return res.status(404).json({ error: 'Key no encontrada' });
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
    const keys = keysValue(namespace);
    res.json({ namespace, keys });
  } catch (err) {
    console.log('[memoria] Error en keys:', err.message);
    res.status(500).json({ error: err.message });
  }
});

router.delete('/clear/:namespace', (req, res) => {
  try {
    const { namespace } = req.params;
    clearNamespace(namespace);
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

    const expiresAt = expireValue(namespace, key, ttl);
    if (expiresAt === null) {
      return res.status(404).json({ error: 'Key no encontrada' });
    }

    res.json({ success: true, namespace, key, expiresAt });
  } catch (err) {
    console.log('[memoria] Error en expire:', err.message);
    res.status(500).json({ error: err.message });
  }
});

export default router;
