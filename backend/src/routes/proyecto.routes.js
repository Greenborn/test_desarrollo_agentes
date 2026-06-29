import { Router } from 'express';
import db from '../config/db.js';
import memoriaClient from '../services/memoriaClient.js';

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
    const wsIds = req.session.workspaceIds || [1];
    const proyectos = await db('proyectos').whereIn('workspace_id', wsIds).select('*').orderBy('id');
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
    const wsIds = req.session.workspaceIds || [1];
    const wsId = req.body.workspace_id && wsIds.includes(req.body.workspace_id) ? req.body.workspace_id : wsIds[0] || 1;
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

    if (proyectoId) {
      const proyecto = await db('proyectos')
        .where({ id: proyectoId })
        .select('workspace_id')
        .first();

      if (proyecto?.workspace_id) {
        updateData.workspace_id = proyecto.workspace_id;

        const oldIds = req.session.workspaceIds || [1];
        if (!oldIds.includes(proyecto.workspace_id)) {
          const newIds = [...oldIds, proyecto.workspace_id];
          req.session.workspaceIds = newIds;
          await new Promise(resolve => req.session.save(resolve));

          await db('user_settings')
            .insert({ user_id: req.session.userId, key: 'selected_workspace_id', value: JSON.stringify(newIds) })
            .onConflict(['user_id', 'key'])
            .merge();
        }
      }
    }

    await db('chat_sessions')
      .where({ id: sessionId, user_id: req.session.userId })
      .update(updateData);
    res.json({ success: true, workspaceIds: req.session.workspaceIds || [1] });
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
    const wsIds = req.session.workspaceIds || [1];
    const updated = await db('proyectos')
      .where({ id: proyectoId })
      .whereIn('workspace_id', wsIds)
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
    let query = db('proyectos').select('url_github').where({ id: req.params.proyectoId });

    const sessionId = req.query.sessionId || req.body?.sessionId;
    if (sessionId) {
      const chatSession = await db('chat_sessions').where({ id: sessionId }).select('workspace_id').first();
      if (chatSession) {
        query.where({ workspace_id: chatSession.workspace_id });
      }
    }

    const proyecto = await query.first();
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
    const wsIds = req.session.workspaceIds || [1];
    const proyecto = await db('proyectos')
      .select('id')
      .where({ id: req.params.id })
      .whereIn('workspace_id', wsIds)
      .first();
    if (!proyecto) {
      return res.status(404).json({ error: 'Proyecto no encontrado' });
    }
    const dbVariables = await db('project_variables')
      .select('key', 'value', 'type', 'created_at', 'updated_at')
      .where({ proyecto_id: req.params.id })
      .orderBy('key');

    const variables = [];
    const memoryNamespace = `proyecto:${req.params.id}`;

    for (const v of dbVariables) {
      if (v.type === 'memory') {
        try {
          const memResult = await memoriaClient.get(memoryNamespace, v.key);
          variables.push({ key: v.key, value: memResult.value, type: 'memory', created_at: v.created_at, updated_at: v.updated_at });
        } catch (err) {
          variables.push({ key: v.key, value: '', type: 'memory', created_at: v.created_at, updated_at: v.updated_at });
        }
      } else {
        variables.push({ key: v.key, value: v.value, type: 'db', created_at: v.created_at, updated_at: v.updated_at });
      }
    }

    try {
      const memKeysResult = await memoriaClient.keys(memoryNamespace);
      if (memKeysResult.keys && memKeysResult.keys.length > 0) {
        const existingDbKeys = new Set(dbVariables.map(v => v.key));
        for (const memKey of memKeysResult.keys) {
          if (!existingDbKeys.has(memKey)) {
            try {
              const memResult = await memoriaClient.get(memoryNamespace, memKey);
              variables.push({ key: memKey, value: memResult.value, type: 'memory', created_at: null, updated_at: null });
            } catch {
              variables.push({ key: memKey, value: '', type: 'memory', created_at: null, updated_at: null });
            }
          }
        }
      }
    } catch (err) {
      console.log('Error al obtener keys de memoria:', err.message);
    }

    res.json({ variables });
  } catch (err) {
    console.log('Error al listar variables:', err.message);
    res.status(500).json({ error: err.message });
  }
});

router.post('/proyecto/:id/variables', async (req, res) => {
  if (!authGuard(req, res)) return;
  const { key, value, type } = req.body;
  if (!key) {
    return res.status(400).json({ error: 'key es requerido' });
  }
  if (value === undefined || value === null) {
    return res.status(400).json({ error: 'value es requerido' });
  }
  const varType = type === 'memory' ? 'memory' : 'db';
  try {
    const wsIds = req.session.workspaceIds || [1];
    const proyecto = await db('proyectos')
      .select('id')
      .where({ id: req.params.id })
      .whereIn('workspace_id', wsIds)
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

    if (varType === 'memory') {
      await db('project_variables').insert({
        proyecto_id: req.params.id,
        key,
        value: '',
        type: 'memory',
      });
      const memNamespace = `proyecto:${req.params.id}`;
      await memoriaClient.set(memNamespace, key, value);
    } else {
      await db('project_variables').insert({
        proyecto_id: req.params.id,
        key,
        value: String(value),
        type: 'db',
      });
    }

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
    const wsIds = req.session.workspaceIds || [1];
    const proyecto = await db('proyectos')
      .select('id')
      .where({ id: req.params.id })
      .whereIn('workspace_id', wsIds)
      .first();
    if (!proyecto) {
      return res.status(404).json({ error: 'Proyecto no encontrado' });
    }
    const existing = await db('project_variables')
      .select('type')
      .where({ proyecto_id: req.params.id, key: req.params.key })
      .first();
    if (!existing) {
      return res.status(404).json({ error: `Variable "${req.params.key}" no encontrada` });
    }
    if (existing.type === 'memory') {
      const memNamespace = `proyecto:${req.params.id}`;
      await memoriaClient.set(memNamespace, req.params.key, value);
    } else {
      await db('project_variables')
        .where({ proyecto_id: req.params.id, key: req.params.key })
        .update({ value: String(value), updated_at: db.fn.now() });
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
    const wsIds = req.session.workspaceIds || [1];
    const proyecto = await db('proyectos')
      .select('id')
      .where({ id: req.params.id })
      .whereIn('workspace_id', wsIds)
      .first();
    if (!proyecto) {
      return res.status(404).json({ error: 'Proyecto no encontrado' });
    }
    const existing = await db('project_variables')
      .select('type')
      .where({ proyecto_id: req.params.id, key: req.params.key })
      .first();
    if (!existing) {
      return res.status(404).json({ error: `Variable "${req.params.key}" no encontrada` });
    }
    if (existing.type === 'memory') {
      const memNamespace = `proyecto:${req.params.id}`;
      try {
        await memoriaClient.del(memNamespace, req.params.key);
      } catch (err) {
        console.log('Error al eliminar variable de memoria:', err.message);
      }
    }
    await db('project_variables')
      .where({ proyecto_id: req.params.id, key: req.params.key })
      .delete();
    res.json({ success: true });
  } catch (err) {
    console.log('Error al eliminar variable:', err.message);
    res.status(500).json({ error: err.message });
  }
});

export default router;
