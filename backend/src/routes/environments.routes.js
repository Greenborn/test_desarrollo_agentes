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

router.get('/', async (req, res) => {
  if (!authGuard(req, res)) return;
  try {
    const wsId = req.session.workspaceId || 1;
    const environments = await db('workspace_environments')
      .where({ workspace_id: wsId })
      .select('id', 'name', 'branch', 'description', 'created_at', 'updated_at')
      .orderBy('id');
    res.json({ environments });
  } catch (err) {
    console.log('Error al listar ambientes:', err.message);
    res.status(500).json({ error: err.message });
  }
});

router.post('/', async (req, res) => {
  if (!authGuard(req, res)) return;
  try {
    const { name, branch, description } = req.body;
    if (!name) {
      return res.status(400).json({ error: 'El nombre es requerido' });
    }
    if (!branch) {
      return res.status(400).json({ error: 'La rama es requerida' });
    }

    const wsId = req.session.workspaceId || 1;

    const existing = await db('workspace_environments')
      .where({ workspace_id: wsId, name })
      .first();
    if (existing) {
      return res.status(409).json({ error: `Ya existe un ambiente con el nombre "${name}"` });
    }

    const [insertId] = await db('workspace_environments').insert({
      workspace_id: wsId,
      name,
      branch,
      description: description || null,
    });

    const environment = await db('workspace_environments').where({ id: insertId }).first();
    res.status(201).json({ success: true, environment });
  } catch (err) {
    console.log('Error al crear ambiente:', err.message);
    res.status(500).json({ success: false, error: err.message });
  }
});

router.put('/:id', async (req, res) => {
  if (!authGuard(req, res)) return;
  try {
    const { name, branch, description } = req.body;
    const env = await db('workspace_environments').where({ id: req.params.id }).first();
    if (!env) {
      return res.status(404).json({ error: 'Ambiente no encontrado' });
    }

    const updates = {};
    if (name !== undefined) {
      if (!name) {
        return res.status(400).json({ error: 'El nombre no puede estar vacío' });
      }
      const wsId = req.session.workspaceId || 1;
      const duplicate = await db('workspace_environments')
        .where({ workspace_id: wsId, name })
        .whereNot({ id: req.params.id })
        .first();
      if (duplicate) {
        return res.status(409).json({ error: `Ya existe otro ambiente con el nombre "${name}"` });
      }
      updates.name = name;
    }
    if (branch !== undefined) {
      if (!branch) {
        return res.status(400).json({ error: 'La rama no puede estar vacía' });
      }
      updates.branch = branch;
    }
    if (description !== undefined) {
      updates.description = description || null;
    }

    updates.updated_at = db.fn.now();

    await db('workspace_environments').where({ id: req.params.id }).update(updates);
    const updated = await db('workspace_environments').where({ id: req.params.id }).first();
    res.json({ success: true, environment: updated });
  } catch (err) {
    console.log('Error al actualizar ambiente:', err.message);
    res.status(500).json({ success: false, error: err.message });
  }
});

router.delete('/:id', async (req, res) => {
  if (!authGuard(req, res)) return;
  try {
    const env = await db('workspace_environments').where({ id: req.params.id }).first();
    if (!env) {
      return res.status(404).json({ error: 'Ambiente no encontrado' });
    }

    await db('workspace_environments').where({ id: req.params.id }).del();
    res.json({ success: true });
  } catch (err) {
    console.log('Error al eliminar ambiente:', err.message);
    res.status(500).json({ success: false, error: err.message });
  }
});

export default router;
