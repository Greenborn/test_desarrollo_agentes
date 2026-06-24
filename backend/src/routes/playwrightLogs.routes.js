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

router.get('/network', async (req, res) => {
  if (!authGuard(req, res)) return;

  const chatSessionId = req.query.chat_session_id;
  if (!chatSessionId) {
    return res.status(400).json({ error: 'chat_session_id es requerido' });
  }

  try {
    const logs = await db('playwright_network_logs')
      .where({ chat_session_id: parseInt(chatSessionId) })
      .orderBy('created_at', 'desc')
      .limit(500);
    res.json(logs);
  } catch (err) {
    console.log('Error al obtener network logs:', err.message);
    res.status(500).json({ error: err.message });
  }
});

router.get('/console', async (req, res) => {
  if (!authGuard(req, res)) return;

  const chatSessionId = req.query.chat_session_id;
  if (!chatSessionId) {
    return res.status(400).json({ error: 'chat_session_id es requerido' });
  }

  try {
    let query = db('playwright_console_logs')
      .where({ chat_session_id: parseInt(chatSessionId) });

    const since = req.query.since;
    if (since) {
      query = query.where('created_at', '>', since);
    }

    const types = req.query.types;
    if (types) {
      const typeList = types.split(',').map(t => t.trim()).filter(Boolean);
      if (typeList.length > 0) {
        query = query.whereIn('type', typeList);
      }
    }

    const limit = req.query.limit ? Math.min(parseInt(req.query.limit), 500) : 500;

    const logs = await query
      .orderBy('created_at', 'desc')
      .limit(limit);
    res.json(logs);
  } catch (err) {
    console.log('Error al obtener console logs:', err.message);
    res.status(500).json({ error: err.message });
  }
});

router.delete('/network', async (req, res) => {
  if (!authGuard(req, res)) return;

  const chatSessionId = req.query.chat_session_id;
  if (!chatSessionId) {
    return res.status(400).json({ error: 'chat_session_id es requerido' });
  }

  try {
    await db('playwright_network_logs')
      .where({ chat_session_id: parseInt(chatSessionId) })
      .del();
    res.json({ success: true });
  } catch (err) {
    console.log('Error al limpiar network logs:', err.message);
    res.status(500).json({ error: err.message });
  }
});

router.get('/event-recordings', async (req, res) => {
  if (!authGuard(req, res)) return;

  const { project_id, chat_session_id } = req.query;

  try {
    let query = db('playwright_event_recordings as r')
      .leftJoin('playwright_events as e', 'r.id', 'e.recording_id')
      .select('r.*')
      .count('e.id as event_count')
      .groupBy('r.id')
      .orderBy('r.created_at', 'desc');

    if (project_id) {
      query = query.where('r.project_id', project_id);
    }
    if (chat_session_id) {
      query = query.where('r.chat_session_id', parseInt(chat_session_id));
    }

    const recordings = await query;

    const [{ uncategorizedCount }] = await db('playwright_events')
      .whereNull('recording_id')
      .count('* as uncategorizedCount');

    res.json({ recordings, uncategorizedCount: parseInt(uncategorizedCount) });
  } catch (err) {
    console.log('Error al obtener grabaciones:', err.message);
    res.status(500).json({ error: err.message });
  }
});

router.get('/event-recordings/:id', async (req, res) => {
  if (!authGuard(req, res)) return;

  const { id } = req.params;

  try {
    const recording = await db('playwright_event_recordings as r')
      .leftJoin('playwright_events as e', 'r.id', 'e.recording_id')
      .select('r.*')
      .count('e.id as event_count')
      .where('r.id', id)
      .groupBy('r.id')
      .first();

    if (!recording) {
      return res.status(404).json({ error: 'Grabación no encontrada' });
    }

    res.json(recording);
  } catch (err) {
    console.log('Error al obtener grabación:', err.message);
    res.status(500).json({ error: err.message });
  }
});

router.post('/event-recordings', async (req, res) => {
  if (!authGuard(req, res)) return;

  const { name, chat_session_id, project_id } = req.body;

  if (!name) {
    return res.status(400).json({ error: 'El nombre es requerido' });
  }
  if (!chat_session_id) {
    return res.status(400).json({ error: 'chat_session_id es requerido' });
  }

  try {
    const [id] = await db('playwright_event_recordings').insert({
      name,
      chat_session_id: parseInt(chat_session_id),
      project_id: project_id || null,
    });

    const created = await db('playwright_event_recordings').where({ id }).first();
    res.status(201).json({ ...created, event_count: 0 });
  } catch (err) {
    console.log('Error al crear grabación de eventos:', err.message);
    res.status(500).json({ error: err.message });
  }
});

router.get('/events', async (req, res) => {
  if (!authGuard(req, res)) return;

  const { chat_session_id, recording_id } = req.query;

  if (!chat_session_id && !recording_id) {
    return res.status(400).json({ error: 'chat_session_id o recording_id es requerido' });
  }

  try {
    const orderDir = req.query.order === 'asc' ? 'asc' : 'desc';
    let query = db('playwright_events').orderBy('created_at', orderDir).limit(500);

    if (recording_id) {
      if (recording_id === 'none') {
        query = query.whereNull('recording_id');
      } else {
        query = query.where({ recording_id: parseInt(recording_id) });
      }
    } else {
      query = query.where({ chat_session_id: parseInt(chat_session_id) });
    }

    const logs = await query;
    res.json(logs);
  } catch (err) {
    console.log('Error al obtener eventos:', err.message);
    res.status(500).json({ error: err.message });
  }
});

router.delete('/events', async (req, res) => {
  if (!authGuard(req, res)) return;

  const { chat_session_id, recording_id } = req.query;

  if (!chat_session_id && !recording_id) {
    return res.status(400).json({ error: 'chat_session_id o recording_id es requerido' });
  }

  try {
    let query = db('playwright_events');

    if (recording_id) {
      if (recording_id === 'none') {
        query = query.whereNull('recording_id');
      } else {
        query = query.where({ recording_id: parseInt(recording_id) });
      }
    } else {
      query = query.where({ chat_session_id: parseInt(chat_session_id) });
    }

    await query.del();
    res.json({ success: true });
  } catch (err) {
    console.log('Error al limpiar eventos:', err.message);
    res.status(500).json({ error: err.message });
  }
});

router.delete('/events/:id', async (req, res) => {
  if (!authGuard(req, res)) return;

  const { id } = req.params;

  try {
    const deleted = await db('playwright_events').where({ id }).del();
    if (!deleted) {
      return res.status(404).json({ error: 'Evento no encontrado' });
    }
    res.json({ success: true });
  } catch (err) {
    console.log('Error al eliminar evento:', err.message);
    res.status(500).json({ error: err.message });
  }
});

router.delete('/console', async (req, res) => {
  if (!authGuard(req, res)) return;

  const chatSessionId = req.query.chat_session_id;
  if (!chatSessionId) {
    return res.status(400).json({ error: 'chat_session_id es requerido' });
  }

  try {
    await db('playwright_console_logs')
      .where({ chat_session_id: parseInt(chatSessionId) })
      .del();
    res.json({ success: true });
  } catch (err) {
    console.log('Error al limpiar console logs:', err.message);
    res.status(500).json({ error: err.message });
  }
});

router.put('/event-recordings/:id', async (req, res) => {
  if (!authGuard(req, res)) return;

  const { id } = req.params;
  const { name, project_id } = req.body;

  try {
    const existing = await db('playwright_event_recordings').where({ id }).first();
    if (!existing) {
      return res.status(404).json({ error: 'Grabación no encontrada' });
    }

    const updateData = {};
    if (name !== undefined) updateData.name = name;
    if (project_id !== undefined) updateData.project_id = project_id;

    if (Object.keys(updateData).length > 0) {
      await db('playwright_event_recordings').where({ id }).update(updateData);
    }

    const updated = await db('playwright_event_recordings').where({ id }).first();
    const [{ event_count }] = await db('playwright_events')
      .where({ recording_id: id })
      .count('* as event_count');

    res.json({ ...updated, event_count: parseInt(event_count) });
  } catch (err) {
    console.log('Error al actualizar grabación:', err.message);
    res.status(500).json({ error: err.message });
  }
});

router.delete('/event-recordings/:id', async (req, res) => {
  if (!authGuard(req, res)) return;

  const { id } = req.params;

  try {
    const existing = await db('playwright_event_recordings').where({ id }).first();
    if (!existing) {
      return res.status(404).json({ error: 'Grabación no encontrada' });
    }

    await db('playwright_event_recordings').where({ id }).del();
    res.json({ success: true });
  } catch (err) {
    console.log('Error al eliminar grabación:', err.message);
    res.status(500).json({ error: err.message });
  }
});

export default router;
