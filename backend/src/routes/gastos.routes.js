import { Router } from 'express';

const router = Router();

function authGuard(req, res) {
  if (!req.session?.userId) {
    res.status(401).json({ error: 'Sesión no válida' });
    return false;
  }
  return true;
}

router.get('/', async (req, res) => {
  if (!authGuard(req, res)) return;
  try {
    const gastosPort = process.env.SERVICIO_GASTOS_PORT || 4100;
    const params = new URLSearchParams();
    if (req.query.id_proyecto) params.set('id_proyecto', req.query.id_proyecto);
    if (req.query.id_chat_session) params.set('id_chat_session', req.query.id_chat_session);
    if (req.query.id_sesion_opencode) params.set('id_sesion_opencode', req.query.id_sesion_opencode);
    const qs = params.toString();
    const url = `http://localhost:${gastosPort}/api/gastos${qs ? `?${qs}` : ''}`;
    const response = await fetch(url);
    const data = await response.json();
    res.json(data);
  } catch (err) {
    console.log('Error al obtener gastos:', err.message);
    res.status(500).json({ error: err.message });
  }
});

router.post('/register', async (req, res) => {
  if (!authGuard(req, res)) return;
  try {
    const gastosPort = process.env.SERVICIO_GASTOS_PORT || 4100;
    const response = await fetch(`http://localhost:${gastosPort}/api/gastos/register`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(req.body),
    });
    const data = await response.json();
    res.status(response.status).json(data);
  } catch (err) {
    console.log('Error al registrar gasto:', err.message);
    res.status(500).json({ error: err.message });
  }
});

export default router;
