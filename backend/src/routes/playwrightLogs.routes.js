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

router.post('/event-recordings', async (req, res) => {
  if (!authGuard(req, res)) return;

  const { name, chat_session_id } = req.body;

  if (!name) {
    return res.status(400).json({ error: 'El nombre es requerido' });
  }
  if (!chat_session_id) {
    return res.status(400).json({ error: 'chat_session_id es requerido' });
  }

  try {
    const existing = await db('playwright_event_recordings')
      .where({ name })
      .first();

    if (existing) {
      return res.status(409).json({ error: 'Ya existe una grabación con ese nombre' });
    }

    const [id] = await db('playwright_event_recordings').insert({
      name,
      chat_session_id: parseInt(chat_session_id),
    });

    res.status(201).json({ id, name, chat_session_id: parseInt(chat_session_id) });
  } catch (err) {
    console.log('Error al crear grabación de eventos:', err.message);
    res.status(500).json({ error: err.message });
  }
});

router.get('/events', async (req, res) => {
  if (!authGuard(req, res)) return;

  const chatSessionId = req.query.chat_session_id;
  if (!chatSessionId) {
    return res.status(400).json({ error: 'chat_session_id es requerido' });
  }

  try {
    const logs = await db('playwright_events')
      .where({ chat_session_id: parseInt(chatSessionId) })
      .orderBy('created_at', 'desc')
      .limit(500);
    res.json(logs);
  } catch (err) {
    console.log('Error al obtener eventos:', err.message);
    res.status(500).json({ error: err.message });
  }
});

router.delete('/events', async (req, res) => {
  if (!authGuard(req, res)) return;

  const chatSessionId = req.query.chat_session_id;
  if (!chatSessionId) {
    return res.status(400).json({ error: 'chat_session_id es requerido' });
  }

  try {
    await db('playwright_events')
      .where({ chat_session_id: parseInt(chatSessionId) })
      .del();
    res.json({ success: true });
  } catch (err) {
    console.log('Error al limpiar eventos:', err.message);
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

export default router;
