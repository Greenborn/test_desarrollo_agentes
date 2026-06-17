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
    const wsId = req.session.workspaceId || 1;
    const proyectos = await db('proyectos').where({ workspace_id: wsId }).select('*').orderBy('id');
    const pinnedRow = await db('user_settings')
      .select('value')
      .where({ user_id: req.session.userId, key: 'pinned_project' })
      .first();
    const pinnedProjectId = pinnedRow?.value || null;
    if (pinnedProjectId) {
      const idx = proyectos.findIndex(p => p.id === pinnedProjectId);
      if (idx > 0) {
        const [pinned] = proyectos.splice(idx, 1);
        proyectos.unshift(pinned);
      }
    }
    res.json({ proyectos, pinnedProjectId });
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
    const wsId = req.session.workspaceId || 1;
    await db('proyectos').insert({ id, descripcion, workspace_id: wsId });
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

router.post('/proyecto/pin', async (req, res) => {
  if (!authGuard(req, res)) return;
  const { proyectoId } = req.body;
  try {
    if (proyectoId) {
      await db('user_settings')
        .insert({ user_id: req.session.userId, key: 'pinned_project', value: proyectoId })
        .onConflict(['user_id', 'key'])
        .merge();
    } else {
      await db('user_settings')
        .where({ user_id: req.session.userId, key: 'pinned_project' })
        .delete();
    }
    res.json({ success: true });
  } catch (err) {
    console.log('Error al guardar proyecto pineado:', err.message);
    res.status(500).json({ error: err.message });
  }
});

export default router;
