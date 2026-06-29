import { Router } from 'express';
import db from '../config/db.js';
import memoriaClient from '../services/memoriaClient.js';

const router = Router();

const sseConnections = new Map();

function sendSSE(res, data) {
  res.write(`data: ${JSON.stringify(data)}\n\n`);
}

function addSSEConnection(chatSessionId, res) {
  if (!chatSessionId) return;
  const key = parseInt(chatSessionId);
  if (!sseConnections.has(key)) {
    sseConnections.set(key, new Set());
  }
  sseConnections.get(key).add(res);

  const keepAlive = setInterval(() => {
    try {
      res.write(':ping\n\n');
    } catch {
      clearInterval(keepAlive);
    }
  }, 30000);

  res.on('close', () => {
    clearInterval(keepAlive);
    const conns = sseConnections.get(key);
    if (conns) {
      conns.delete(res);
      if (conns.size === 0) {
        sseConnections.delete(key);
      }
    }
  });
}

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

router.get('/network/stream', (req, res) => {
  if (!authGuard(req, res)) return;

  const chatSessionId = req.query.chat_session_id;
  if (!chatSessionId) {
    return res.status(400).json({ error: 'chat_session_id es requerido' });
  }

  res.writeHead(200, {
    'Content-Type': 'text/event-stream',
    'Cache-Control': 'no-cache',
    'Connection': 'keep-alive',
  });

  sendSSE(res, { type: 'connected', chat_session_id: parseInt(chatSessionId) });
  addSSEConnection(chatSessionId, res);
});

router.post('/network/notify', (req, res) => {
  const { chat_session_id, method, url, status_code, error, resource_type, instance_name } = req.body;
  if (!chat_session_id) {
    return res.status(400).json({ error: 'chat_session_id es requerido' });
  }

  const key = parseInt(chat_session_id);
  const conns = sseConnections.get(key);
  if (conns) {
    const payload = {
      type: 'network_error',
      chat_session_id: key,
      method,
      url,
      status_code: status_code || null,
      error,
      resource_type: resource_type || null,
      instance_name,
    };
    for (const res of conns) {
      try {
        sendSSE(res, payload);
      } catch (err) {
        console.log('Error al enviar SSE de network:', err.message);
      }
    }
  }

  res.json({ success: true });
});

router.post('/network/store', async (req, res) => {
  const { chat_session_id, method, url, status_code, error, resource_type, instance_name } = req.body;
  if (!chat_session_id) {
    return res.status(400).json({ error: 'chat_session_id es requerido' });
  }

  if (instance_name) {
    try {
      const session = await db('chat_sessions')
        .select('proyecto_id')
        .where({ id: parseInt(chat_session_id) })
        .first();

      if (session && session.proyecto_id) {
        const proyectoId = session.proyecto_id;
        const memNamespace = `proyecto:${proyectoId}`;
        const varKey = 'NAVEGADOR_NETWORK_ERRORS';
        let currentValue = {};

        try {
          const memResult = await memoriaClient.get(memNamespace, varKey);
          currentValue = typeof memResult.value === 'string' ? JSON.parse(memResult.value) : memResult.value;
        } catch (err) {
          currentValue = {};
        }

        if (typeof currentValue !== 'object' || currentValue === null) {
          currentValue = {};
        }
        if (!Array.isArray(currentValue[instance_name])) {
          currentValue[instance_name] = [];
        }

        currentValue[instance_name].push({
          method,
          url,
          status_code: status_code || null,
          error: error || null,
          resource_type: resource_type || null,
          timestamp: Date.now(),
        });

        await memoriaClient.set(memNamespace, varKey, JSON.stringify(currentValue));
      }
    } catch (err) {
      console.log('[playwrightLogs] Error al almacenar petición en NAVEGADOR_NETWORK_ERRORS:', err.message);
    }
  }

  res.json({ success: true });
});

router.get('/console', async (req, res) => {
  if (!authGuard(req, res)) return;

  const chatSessionId = req.query.chat_session_id;
  if (!chatSessionId) {
    return res.status(400).json({ error: 'chat_session_id es requerido' });
  }

  try {
    const logs = await db('playwright_console_logs')
      .where({ chat_session_id: parseInt(chatSessionId) })
      .orderBy('created_at', 'desc')
      .limit(500);
    res.json(logs);
  } catch (err) {
    console.log('Error al obtener console logs:', err.message);
    res.status(500).json({ error: err.message });
  }
});

router.get('/console/stream', (req, res) => {
  if (!authGuard(req, res)) return;

  const chatSessionId = req.query.chat_session_id;
  if (!chatSessionId) {
    return res.status(400).json({ error: 'chat_session_id es requerido' });
  }

  res.writeHead(200, {
    'Content-Type': 'text/event-stream',
    'Cache-Control': 'no-cache',
    'Connection': 'keep-alive',
  });

  sendSSE(res, { type: 'connected', chat_session_id: parseInt(chatSessionId) });
  addSSEConnection(chatSessionId, res);
});

router.post('/console/notify', async (req, res) => {
  const { chat_session_id, type, text, location, instance_name } = req.body;
  if (!chat_session_id) {
    return res.status(400).json({ error: 'chat_session_id es requerido' });
  }

  const key = parseInt(chat_session_id);
  const conns = sseConnections.get(key);
  if (conns) {
    const payload = { type: 'console', chat_session_id: key, console_type: type, text, location, instance_name };
    for (const res of conns) {
      try {
        sendSSE(res, payload);
      } catch (err) {
        console.log('Error al enviar SSE:', err.message);
      }
    }
  }

  if (instance_name) {
    try {
      const session = await db('chat_sessions')
        .select('proyecto_id')
        .where({ id: key })
        .first();

      if (session && session.proyecto_id) {
        const proyectoId = session.proyecto_id;
        const memNamespace = `proyecto:${proyectoId}`;

        const logType = type === 'error' ? 'error' : type === 'warn' ? 'warn' : 'log';
        const varKey = logType === 'error' ? 'NAVEGADOR_CONSOLE_ERRORS'
          : logType === 'warn' ? 'NAVEGADOR_CONSOLE_WARNS'
          : 'NAVEGADOR_CONSOLE_LOGS';

        let currentValue = {};

        try {
          const memResult = await memoriaClient.get(memNamespace, varKey);
          currentValue = typeof memResult.value === 'string' ? JSON.parse(memResult.value) : memResult.value;
        } catch (err) {
          currentValue = {};
        }

        if (typeof currentValue !== 'object' || currentValue === null) {
          currentValue = {};
        }
        if (!Array.isArray(currentValue[instance_name])) {
          currentValue[instance_name] = [];
        }

        currentValue[instance_name].push({
          type,
          text,
          location,
          timestamp: Date.now(),
        });

        await memoriaClient.set(memNamespace, varKey, JSON.stringify(currentValue));
      }
    } catch (err) {
      console.log('[playwrightLogs] Error al actualizar variable de consola:', err.message);
    }
  }

  res.json({ success: true });
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

router.post('/events', async (req, res) => {
  if (!authGuard(req, res)) return;

  const { chat_session_id, recording_id, event_type, selector, tag_name, text_content, value, url, x, y, key, key_code, alt_key, ctrl_key, shift_key, meta_key, scroll_x, scroll_y, metadata } = req.body;

  if (!chat_session_id) {
    return res.status(400).json({ error: 'chat_session_id es requerido' });
  }
  if (!event_type) {
    return res.status(400).json({ error: 'event_type es requerido' });
  }

  try {
    const [id] = await db('playwright_events').insert({
      chat_session_id: parseInt(chat_session_id),
      recording_id: recording_id != null ? parseInt(recording_id) : null,
      event_type,
      selector: selector || null,
      tag_name: tag_name || null,
      text_content: text_content || null,
      value: value != null ? String(value).substring(0, 1000) : null,
      url: url || null,
      x: x != null ? x : null,
      y: y != null ? y : null,
      key: key || null,
      key_code: key_code || null,
      alt_key: alt_key != null ? alt_key : null,
      ctrl_key: ctrl_key != null ? ctrl_key : null,
      shift_key: shift_key != null ? shift_key : null,
      meta_key: meta_key != null ? meta_key : null,
      scroll_x: scroll_x != null ? scroll_x : null,
      scroll_y: scroll_y != null ? scroll_y : null,
      metadata: metadata || null,
    });

    const created = await db('playwright_events').where({ id }).first();
    res.status(201).json(created);
  } catch (err) {
    console.log('Error al crear evento:', err.message);
    res.status(500).json({ error: err.message });
  }
});

router.patch('/events/:id', async (req, res) => {
  if (!authGuard(req, res)) return;

  const { id } = req.params;
  const { value, text_content, metadata } = req.body;

  try {
    const existing = await db('playwright_events').where({ id }).first();
    if (!existing) {
      return res.status(404).json({ error: 'Evento no encontrado' });
    }

    const updateData = {};
    if (value !== undefined) updateData.value = String(value).substring(0, 1000);
    if (text_content !== undefined) updateData.text_content = String(text_content).substring(0, 1000);
    if (metadata !== undefined) updateData.metadata = metadata;

    if (Object.keys(updateData).length > 0) {
      await db('playwright_events').where({ id }).update(updateData);
    }

    const updated = await db('playwright_events').where({ id }).first();
    res.json(updated);
  } catch (err) {
    console.log('Error al actualizar evento:', err.message);
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

router.post('/event-recordings/:id/clone', async (req, res) => {
  if (!authGuard(req, res)) return;

  const { id } = req.params;

  try {
    const original = await db('playwright_event_recordings').where({ id }).first();
    if (!original) {
      return res.status(404).json({ error: 'Grabación no encontrada' });
    }

    const newName = `${original.name} (copia)`;

    const [newRecording] = await db('playwright_event_recordings').insert({
      name: newName,
      chat_session_id: original.chat_session_id,
      project_id: original.project_id,
      playwright_session_id: original.playwright_session_id,
    });

    const events = await db('playwright_events').where({ recording_id: id });
    if (events.length > 0) {
      const copiedEvents = events.map(e => {
        const { id: _ignore, ...rest } = e;
        return { ...rest, recording_id: newRecording };
      });
      await db('playwright_events').insert(copiedEvents);
    }

    const [{ event_count }] = await db('playwright_events')
      .where({ recording_id: newRecording })
      .count('* as event_count');

    const result = await db('playwright_event_recordings').where({ id: newRecording }).first();
    res.json({ ...result, event_count: parseInt(event_count) });
  } catch (err) {
    console.log('Error al clonar grabación:', err.message);
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
