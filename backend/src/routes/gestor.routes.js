import { Router } from 'express';
import gestorClient from '../services/gestorClient.js';

const router = Router();

function authGuard(req, res) {
  if (!req.session?.userId) {
    res.status(401).json({ error: 'Sesión no válida' });
    return false;
  }
  return true;
}

router.get('/services', async (req, res) => {
  if (!authGuard(req, res)) return;

  try {
    const data = await gestorClient.listServices();
    res.json(data);
  } catch (err) {
    console.log('[gestor] Error al listar servicios:', err.message);
    res.status(502).json({ error: err.message });
  }
});

router.post('/services/:name/restart', async (req, res) => {
  if (!authGuard(req, res)) return;

  const { name } = req.params;

  try {
    const data = await gestorClient.restartService(name);
    res.json(data);
  } catch (err) {
    console.log('[gestor] Error al reiniciar servicio:', err.message);
    res.status(502).json({ error: err.message });
  }
});

export default router;
