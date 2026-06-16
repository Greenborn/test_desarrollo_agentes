import { Router } from 'express';
import db from '../config/db.js';

const router = Router();

function authGuard(req, res) {
  if (!req.session?.userId) {
    res.status(401).json({ error: 'Sesión no válida' });
    return false;
  }
  return true;
}

router.get('/proyecto', async (req, res) => {
  if (!authGuard(req, res)) return;
  try {
    const proyectos = await db('proyectos').select('id', 'descripcion').orderBy('id');
    res.json({ proyectos });
  } catch (err) {
    console.log('Error al listar proyectos:', err.message);
    res.status(500).json({ error: err.message });
  }
});

router.post('/proyecto', async (req, res) => {
  if (!authGuard(req, res)) return;
  const { id, descripcion } = req.body;
  if (!id || !descripcion) {
    return res.status(400).json({ error: 'id y descripcion son requeridos' });
  }
  try {
    await db('proyectos').insert({ id, descripcion });
    res.json({ success: true });
  } catch (err) {
    console.log('Error al crear proyecto:', err.message);
    res.status(500).json({ error: err.message });
  }
});

router.get('/proyecto/session/:sessionId', async (req, res) => {
  if (!authGuard(req, res)) return;
  try {
    const session = await db('chat_sessions')
      .select('proyecto_id')
      .where({ id: req.params.sessionId, user_id: req.session.userId })
      .first();
    res.json({ proyectoId: session?.proyecto_id || null });
  } catch (err) {
    console.log('Error al obtener proyecto de sesión:', err.message);
    res.status(500).json({ error: err.message });
  }
});

router.post('/proyecto/session', async (req, res) => {
  if (!authGuard(req, res)) return;
  const { sessionId, proyectoId, cwd } = req.body;
  if (!sessionId) {
    return res.status(400).json({ error: 'sessionId es requerido' });
  }
  try {
    const updateData = { proyecto_id: proyectoId || null, updated_at: db.fn.now() };
    if (cwd) updateData.cwd = cwd;
    await db('chat_sessions')
      .where({ id: sessionId, user_id: req.session.userId })
      .update(updateData);
    res.json({ success: true });
  } catch (err) {
    console.log('Error al asignar proyecto a sesión:', err.message);
    res.status(500).json({ error: err.message });
  }
});

export default router;
