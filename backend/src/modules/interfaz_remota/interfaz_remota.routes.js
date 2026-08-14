import { Router } from 'express';
import { getInterfazRemotaStatus } from './interfaz_remota.service.js';

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

export default router;
