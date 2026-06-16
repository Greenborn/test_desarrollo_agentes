import { Router } from 'express';
import db from '../config/db.js';
import { streamChat } from '../services/deepseek.js';

const router = Router();

function authGuard(req, res) {
  if (!req.session?.userId) {
    res.status(401).json({ error: 'Sesión no válida' });
    return false;
  }
  return true;
}

function generateTitle() {
  const now = new Date();
  const pad = (n) => String(n).padStart(2, '0');
  return `${pad(now.getDate())}/${pad(now.getMonth() + 1)} ${pad(now.getHours())}:${pad(now.getMinutes())}`;
}

router.get('/sessions', async (req, res) => {
  if (!authGuard(req, res)) return;
  try {
    const sessions = await db('chat_sessions')
      .where({ user_id: req.session.userId })
      .orderBy('updated_at', 'desc')
      .leftJoin('proyectos', 'chat_sessions.proyecto_id', 'proyectos.id')
      .select(
        'chat_sessions.id',
        'title',
        'updated_at',
        'cwd',
        'proyecto_id',
        'proyectos.descripcion as proyecto_descripcion'
      );
    res.json({ sessions });
  } catch (err) {
    console.log('Error al cargar sesiones:', err.message);
    res.status(500).json({ sessions: [], error: err.message });
  }
});

router.post('/sessions', async (req, res) => {
  if (!authGuard(req, res)) return;
  try {
    const title = generateTitle();
    const cwd = req.body.cwd ? req.body.cwd : process.cwd();
    const [id] = await db('chat_sessions').insert({ user_id: req.session.userId, title, cwd });
    const session = await db('chat_sessions').where({ id }).first();
    res.status(201).json({ session });
  } catch (err) {
    console.log('Error al crear sesión:', err.message);
    res.status(500).json({ session: null, error: err.message });
  }
});

router.get('/sessions/:id/messages', async (req, res) => {
  if (!authGuard(req, res)) return;
  try {
    const messages = await db('chat_messages')
      .where({ session_id: req.params.id })
      .orderBy('created_at', 'asc')
      .select('id', 'role', 'content', 'thinking', 'created_at');
    res.json({ sessionId: Number(req.params.id), messages });
  } catch (err) {
    console.log('Error al cargar mensajes:', err.message);
    res.status(500).json({ sessionId: Number(req.params.id), messages: [], error: err.message });
  }
});

router.post('/sessions/:id/messages', async (req, res) => {
  if (!authGuard(req, res)) return;
  const sessionId = req.params.id;
  const { message } = req.body;

  try {
    await db('chat_messages').insert({ session_id: sessionId, role: 'user', content: message });
    await db('chat_sessions').where({ id: sessionId }).update({ updated_at: db.fn.now() });

    const history = await db('chat_messages')
      .where({ session_id: sessionId })
      .orderBy('created_at', 'asc')
      .select('role', 'content');

    res.writeHead(200, {
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache',
      'Connection': 'keep-alive',
    });

    let fullThinking = '';
    let fullResponse = '';

    for await (const chunk of streamChat(history)) {
      if (chunk.type === 'thinking') {
        fullThinking += chunk.content;
      } else {
        fullResponse += chunk.content;
      }
      res.write(`data: ${JSON.stringify(chunk)}\n\n`);
    }

    await db('chat_messages').insert({
      session_id: sessionId,
      role: 'assistant',
      content: fullResponse,
      thinking: fullThinking ? fullThinking : null,
    });
    await db('chat_sessions').where({ id: sessionId }).update({ updated_at: db.fn.now() });

    res.write(`data: ${JSON.stringify({ type: 'done', sessionId })}\n\n`);
    res.end();
  } catch (err) {
    console.log('Error al enviar mensaje:', err.message);
    if (res.headersSent) {
      res.write(`data: ${JSON.stringify({ type: 'error', content: err.message })}\n\n`);
      res.end();
    } else {
      res.status(500).json({ error: err.message });
    }
  }
});

router.delete('/sessions/:sessionId/messages/:messageId', async (req, res) => {
  if (!authGuard(req, res)) return;
  try {
    const session = await db('chat_sessions').where({ id: req.params.sessionId, user_id: req.session.userId }).first();
    if (!session) return res.status(404).json({ error: 'Sesión no encontrada' });
    const deleted = await db('chat_messages').where({ id: req.params.messageId, session_id: req.params.sessionId }).del();
    if (!deleted) return res.status(404).json({ error: 'Mensaje no encontrado' });
    res.json({ success: true });
  } catch (err) {
    console.log('Error al eliminar mensaje:', err.message);
    res.status(500).json({ success: false, error: err.message });
  }
});

router.delete('/sessions/:id', async (req, res) => {
  if (!authGuard(req, res)) return;
  try {
    await db('chat_messages').where({ session_id: req.params.id }).del();
    await db('chat_sessions').where({ id: req.params.id }).del();
    res.json({ success: true, sessionId: req.params.id });
  } catch (err) {
    console.log('Error al eliminar sesión:', err.message);
    res.status(500).json({ success: false, sessionId: req.params.id, error: err.message });
  }
});

export default router;
