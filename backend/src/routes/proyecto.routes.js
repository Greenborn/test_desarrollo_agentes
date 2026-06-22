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

router.put('/proyecto/repositorio', async (req, res) => {
  if (!authGuard(req, res)) return;
  const { proyectoId, url_github } = req.body;
  if (!proyectoId) {
    return res.status(400).json({ error: 'proyectoId es requerido' });
  }
  try {
    const wsId = req.session.workspaceId || 1;
    const updated = await db('proyectos')
      .where({ id: proyectoId, workspace_id: wsId })
      .update({ url_github: url_github || null });
    if (!updated) {
      return res.status(404).json({ error: 'Proyecto no encontrado' });
    }
    res.json({ success: true });
  } catch (err) {
    console.log('Error al actualizar repositorio:', err.message);
    res.status(500).json({ error: err.message });
  }
});

router.get('/proyecto/repositorio/:proyectoId', async (req, res) => {
  if (!authGuard(req, res)) return;
  try {
    const wsId = req.session.workspaceId || 1;
    const proyecto = await db('proyectos')
      .select('url_github')
      .where({ id: req.params.proyectoId, workspace_id: wsId })
      .first();
    res.json({ url_github: proyecto?.url_github || null });
  } catch (err) {
    console.log('Error al obtener repositorio:', err.message);
    res.status(500).json({ error: err.message });
  }
});

// ─── Project Variables CRUD ────────────────────────────────────────────────

router.get('/proyecto/:id/variables', async (req, res) => {
  if (!authGuard(req, res)) return;
  try {
    const wsId = req.session.workspaceId || 1;
    const proyecto = await db('proyectos')
      .select('id')
      .where({ id: req.params.id, workspace_id: wsId })
      .first();
    if (!proyecto) {
      return res.status(404).json({ error: 'Proyecto no encontrado' });
    }
    const variables = await db('project_variables')
      .select('key', 'value')
      .where({ proyecto_id: req.params.id })
      .orderBy('key');
    res.json({ variables });
  } catch (err) {
    console.log('Error al listar variables:', err.message);
    res.status(500).json({ error: err.message });
  }
});

router.post('/proyecto/:id/variables', async (req, res) => {
  if (!authGuard(req, res)) return;
  const { key, value } = req.body;
  if (!key) {
    return res.status(400).json({ error: 'key es requerido' });
  }
  if (value === undefined || value === null) {
    return res.status(400).json({ error: 'value es requerido' });
  }
  try {
    const wsId = req.session.workspaceId || 1;
    const proyecto = await db('proyectos')
      .select('id')
      .where({ id: req.params.id, workspace_id: wsId })
      .first();
    if (!proyecto) {
      return res.status(404).json({ error: 'Proyecto no encontrado' });
    }
    const existing = await db('project_variables')
      .where({ proyecto_id: req.params.id, key })
      .first();
    if (existing) {
      return res.status(409).json({ error: `La variable "${key}" ya existe en este proyecto` });
    }
    await db('project_variables').insert({
      proyecto_id: req.params.id,
      key,
      value: String(value),
    });
    res.json({ success: true });
  } catch (err) {
    console.log('Error al crear variable:', err.message);
    res.status(500).json({ error: err.message });
  }
});

router.put('/proyecto/:id/variables/:key', async (req, res) => {
  if (!authGuard(req, res)) return;
  const { value } = req.body;
  if (value === undefined || value === null) {
    return res.status(400).json({ error: 'value es requerido' });
  }
  try {
    const wsId = req.session.workspaceId || 1;
    const proyecto = await db('proyectos')
      .select('id')
      .where({ id: req.params.id, workspace_id: wsId })
      .first();
    if (!proyecto) {
      return res.status(404).json({ error: 'Proyecto no encontrado' });
    }
    const updated = await db('project_variables')
      .where({ proyecto_id: req.params.id, key: req.params.key })
      .update({ value: String(value), updated_at: db.fn.now() });
    if (!updated) {
      return res.status(404).json({ error: `Variable "${req.params.key}" no encontrada` });
    }
    res.json({ success: true });
  } catch (err) {
    console.log('Error al actualizar variable:', err.message);
    res.status(500).json({ error: err.message });
  }
});

router.delete('/proyecto/:id/variables/:key', async (req, res) => {
  if (!authGuard(req, res)) return;
  try {
    const wsId = req.session.workspaceId || 1;
    const proyecto = await db('proyectos')
      .select('id')
      .where({ id: req.params.id, workspace_id: wsId })
      .first();
    if (!proyecto) {
      return res.status(404).json({ error: 'Proyecto no encontrado' });
    }
    const deleted = await db('project_variables')
      .where({ proyecto_id: req.params.id, key: req.params.key })
      .delete();
    if (!deleted) {
      return res.status(404).json({ error: `Variable "${req.params.key}" no encontrada` });
    }
    res.json({ success: true });
  } catch (err) {
    console.log('Error al eliminar variable:', err.message);
    res.status(500).json({ error: err.message });
  }
});

export default router;
