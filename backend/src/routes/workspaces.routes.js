import { Router } from 'express';
import db from '../config/db.js';
import opencode from '../services/opencode.js';

const router = Router();
const PW_URL = `http://localhost:${process.env.SERVICIO_PLAYWRIGHT_PORT || 4098}`;

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
    const workspaces = await db('workspaces').select('*').orderBy('id');
    res.json({ workspaces });
  } catch (err) {
    console.log('Error al listar workspaces:', err.message);
    res.status(500).json({ error: err.message });
  }
});

router.post('/', async (req, res) => {
  if (!authGuard(req, res)) return;
  try {
    const { name } = req.body;
    if (!name) {
      return res.status(400).json({ error: 'El nombre es requerido' });
    }

    const [insertId] = await db('workspaces').insert({ name });

    const defaultSettings = await db('settings').where({ workspace_id: 1 });
    if (defaultSettings.length > 0) {
      const copies = defaultSettings.map(s => ({
        workspace_id: insertId,
        setting_key: s.setting_key,
        setting_value: s.setting_value,
        encrypted: s.encrypted,
      }));
      await db('settings').insert(copies).onConflict(['workspace_id', 'setting_key']).ignore();
    }

    const workspace = await db('workspaces').where({ id: insertId }).first();
    res.status(201).json({ success: true, workspace });
  } catch (err) {
    console.log('Error al crear workspace:', err.message);
    res.status(500).json({ success: false, error: err.message });
  }
});

router.put('/:id', async (req, res) => {
  if (!authGuard(req, res)) return;
  try {
    const { name } = req.body;
    if (!name) {
      return res.status(400).json({ error: 'El nombre es requerido' });
    }

    const ws = await db('workspaces').where({ id: req.params.id }).first();
    if (!ws) {
      return res.status(404).json({ error: 'Workspace no encontrado' });
    }

    await db('workspaces').where({ id: req.params.id }).update({ name });
    res.json({ success: true });
  } catch (err) {
    console.log('Error al actualizar workspace:', err.message);
    res.status(500).json({ success: false, error: err.message });
  }
});

router.delete('/:id', async (req, res) => {
  if (!authGuard(req, res)) return;
  try {
    const ws = await db('workspaces').where({ id: req.params.id }).first();
    if (!ws) {
      return res.status(404).json({ error: 'Workspace no encontrado' });
    }
    if (ws.is_default) {
      return res.status(400).json({ error: 'No se puede eliminar el workspace por defecto' });
    }

    await db('chat_sessions').where({ workspace_id: req.params.id }).del();
    await db('tickets').where({ workspace_id: req.params.id }).del();
    await db('proyectos').where({ workspace_id: req.params.id }).del();
    await db('settings').where({ workspace_id: req.params.id }).del();
    await db('workspaces').where({ id: req.params.id }).del();

    res.json({ success: true });
  } catch (err) {
    console.log('Error al eliminar workspace:', err.message);
    res.status(500).json({ success: false, error: err.message });
  }
});

router.post('/stop-all', async (req, res) => {
  if (!authGuard(req, res)) return;
  try {
    opencode.stopAllServers();

    try {
      await fetch(`${PW_URL}/api/command`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ comando: 'close_all' }),
      });
    } catch (e) {
      console.log('[workspaces] error al cerrar navegadores:', e.message);
    }

    res.json({ success: true });
  } catch (err) {
    console.log('Error al detener procesos:', err.message);
    res.status(500).json({ success: false, error: err.message });
  }
});

router.post('/switch', async (req, res) => {
  if (!authGuard(req, res)) return;
  try {
    const { workspaceId } = req.body;
    if (!workspaceId) {
      return res.status(400).json({ error: 'workspaceId es requerido' });
    }

    const ws = await db('workspaces').where({ id: workspaceId }).first();
    if (!ws) {
      return res.status(400).json({ error: 'Workspace no encontrado' });
    }

    opencode.stopAllServers();

    try {
      await fetch(`${PW_URL}/api/command`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ comando: 'close_all' }),
      });
    } catch (e) {
      console.log('[workspaces] error al cerrar navegadores:', e.message);
    }

    req.session.workspaceId = workspaceId;
    await new Promise((resolve) => req.session.save(resolve));

    await db('user_settings')
      .insert({ user_id: req.session.userId, key: 'selected_workspace_id', value: String(workspaceId) })
      .onConflict(['user_id', 'key'])
      .merge();

    res.json({ success: true, workspaceId });
  } catch (err) {
    console.log('Error al cambiar workspace:', err.message);
    res.status(500).json({ success: false, error: err.message });
  }
});

export default router;
