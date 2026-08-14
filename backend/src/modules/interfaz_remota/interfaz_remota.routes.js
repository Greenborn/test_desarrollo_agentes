import { Router } from 'express';
import {
  getInterfazRemotaStatus,
  setInterfazRemotaEnabled,
  enableInterfazRemota,
} from './interfaz_remota.service.js';

const router = Router();

function authGuard(req, res) {
  if (!req.session?.userId) {
    res.status(401).json({ error: 'No autorizado' });
    return false;
  }
  return true;
}

router.get('/status', (req, res) => {
  if (!authGuard(req, res)) return;
  const state = getInterfazRemotaStatus();
  res.json(state);
});

router.post('/enable', async (req, res) => {
  if (!authGuard(req, res)) return;
  try {
    await enableInterfazRemota();
    res.json(getInterfazRemotaStatus());
  } catch (err) {
    console.log('[interfaz_remota] Error al habilitar conexión:', err.message);
    res.status(500).json({ error: err.message });
  }
});

router.post('/disable', (req, res) => {
  if (!authGuard(req, res)) return;
  setInterfazRemotaEnabled(false);
  res.json(getInterfazRemotaStatus());
});

export default router;
