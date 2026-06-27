import { Router } from 'express';
import { spawn } from 'child_process';
import db from '../config/db.js';

const router = Router();

function authGuard(req, res) {
  if (!req.session?.userId) {
    res.status(401).json({ error: 'Sesión no válida' });
    return false;
  }
  return true;
}

router.get('/detail/:id', async (req, res) => {
  if (!authGuard(req, res)) return;
  try {
    const comando = await db('comandos_personalizados_proyectos')
      .where({ id: req.params.id })
      .first();
    if (!comando) {
      return res.status(404).json({ error: 'Comando no encontrado' });
    }
    res.json({ comando });
  } catch (err) {
    console.log('Error al obtener comando personalizado:', err.message);
    res.status(500).json({ error: err.message });
  }
});

router.get('/:proyectoId', async (req, res) => {
  if (!authGuard(req, res)) return;
  try {
    const wsIds = req.session.workspaceIds || [1];
    const proyecto = await db('proyectos')
      .select('id')
      .where({ id: req.params.proyectoId })
      .whereIn('workspace_id', wsIds)
      .first();
    if (!proyecto) {
      return res.status(404).json({ error: 'Proyecto no encontrado' });
    }
    const comandos = await db('comandos_personalizados_proyectos')
      .where({ id_proyecto: req.params.proyectoId })
      .orderBy('label', 'asc')
      .select('*');
    res.json({ comandos });
  } catch (err) {
    console.log('Error al listar comandos personalizados:', err.message);
    res.status(500).json({ error: err.message });
  }
});

router.post('/', async (req, res) => {
  if (!authGuard(req, res)) return;
  const { label, descripcion, id_proyecto, comando } = req.body;
  if (!label) {
    return res.status(400).json({ error: 'label es requerido' });
  }
  if (!id_proyecto) {
    return res.status(400).json({ error: 'id_proyecto es requerido' });
  }
  if (!comando) {
    return res.status(400).json({ error: 'comando es requerido' });
  }
  if (comando.length > 512) {
    return res.status(400).json({ error: 'comando no puede exceder 512 caracteres' });
  }
  try {
    const wsIds = req.session.workspaceIds || [1];
    const proyecto = await db('proyectos')
      .select('id')
      .where({ id: id_proyecto })
      .whereIn('workspace_id', wsIds)
      .first();
    if (!proyecto) {
      return res.status(404).json({ error: 'Proyecto no encontrado' });
    }
    const [id] = await db('comandos_personalizados_proyectos').insert({
      label,
      descripcion: descripcion || null,
      id_proyecto,
      comando,
    });
    const created = await db('comandos_personalizados_proyectos').where({ id }).first();
    res.status(201).json({ comando: created });
  } catch (err) {
    console.log('Error al crear comando personalizado:', err.message);
    res.status(500).json({ error: err.message });
  }
});

router.put('/:id', async (req, res) => {
  if (!authGuard(req, res)) return;
  const { label, descripcion, comando } = req.body;
  if (!label) {
    return res.status(400).json({ error: 'label es requerido' });
  }
  if (!comando) {
    return res.status(400).json({ error: 'comando es requerido' });
  }
  if (comando.length > 512) {
    return res.status(400).json({ error: 'comando no puede exceder 512 caracteres' });
  }
  try {
    const existing = await db('comandos_personalizados_proyectos')
      .where({ id: req.params.id })
      .first();
    if (!existing) {
      return res.status(404).json({ error: 'Comando no encontrado' });
    }
    const wsIds = req.session.workspaceIds || [1];
    const proyecto = await db('proyectos')
      .select('id')
      .where({ id: existing.id_proyecto })
      .whereIn('workspace_id', wsIds)
      .first();
    if (!proyecto) {
      return res.status(404).json({ error: 'Proyecto no encontrado' });
    }
    await db('comandos_personalizados_proyectos')
      .where({ id: req.params.id })
      .update({ label, descripcion: descripcion || null, comando, updated_at: db.fn.now() });
    const updated = await db('comandos_personalizados_proyectos').where({ id: req.params.id }).first();
    res.json({ comando: updated });
  } catch (err) {
    console.log('Error al actualizar comando personalizado:', err.message);
    res.status(500).json({ error: err.message });
  }
});

router.delete('/:id', async (req, res) => {
  if (!authGuard(req, res)) return;
  try {
    const existing = await db('comandos_personalizados_proyectos')
      .where({ id: req.params.id })
      .first();
    if (!existing) {
      return res.status(404).json({ error: 'Comando no encontrado' });
    }
    const wsIds = req.session.workspaceIds || [1];
    const proyecto = await db('proyectos')
      .select('id')
      .where({ id: existing.id_proyecto })
      .whereIn('workspace_id', wsIds)
      .first();
    if (!proyecto) {
      return res.status(404).json({ error: 'Proyecto no encontrado' });
    }
    await db('comandos_personalizados_proyectos').where({ id: req.params.id }).delete();
    res.json({ success: true });
  } catch (err) {
    console.log('Error al eliminar comando personalizado:', err.message);
    res.status(500).json({ error: err.message });
  }
});

router.post('/:id/execute', async (req, res) => {
  if (!authGuard(req, res)) return;
  const { sessionId } = req.body;
  try {
    const comando = await db('comandos_personalizados_proyectos')
      .where({ id: req.params.id })
      .first();
    if (!comando) {
      return res.status(404).json({ error: 'Comando no encontrado' });
    }

    let cwd = process.cwd();
    if (sessionId) {
      const session = await db('chat_sessions').where({ id: sessionId }).select('cwd').first();
      if (session && session.cwd) cwd = session.cwd;
    }

    res.writeHead(200, {
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache',
      'Connection': 'keep-alive',
    });

    const proc = spawn('/bin/sh', ['-c', comando.comando], {
      cwd,
      env: { ...process.env },
      stdio: ['ignore', 'pipe', 'pipe'],
    });

    let aborted = false;
    req.on('close', () => {
      aborted = true;
      proc.kill('SIGTERM');
    });

    proc.stdout.on('data', (data) => {
      if (aborted) return;
      const text = data.toString();
      if (text) {
        res.write(`data: ${JSON.stringify({ type: 'stdout', content: text })}\n\n`);
      }
    });

    proc.stderr.on('data', (data) => {
      if (aborted) return;
      const text = data.toString();
      if (text) {
        res.write(`data: ${JSON.stringify({ type: 'stderr', content: text })}\n\n`);
      }
    });

    proc.on('exit', (code) => {
      if (!aborted) {
        res.write(`data: ${JSON.stringify({ type: 'exit', code })}\n\n`);
        res.write('data: [DONE]\n\n');
      }
      res.end();
    });

    proc.on('error', (err) => {
      if (!aborted) {
        res.write(`data: ${JSON.stringify({ type: 'error', content: err.message })}\n\n`);
        res.write('data: [DONE]\n\n');
      }
      res.end();
    });
  } catch (err) {
    console.log('Error al ejecutar comando personalizado:', err.message);
    if (res.headersSent) {
      res.write(`data: ${JSON.stringify({ type: 'error', content: err.message })}\n\n`);
      res.write('data: [DONE]\n\n');
      res.end();
    } else {
      res.status(500).json({ error: err.message });
    }
  }
});

export default router;
