import db from '../config/db.js';
import { streamChat } from '../services/deepseek.js';

function generateTitle() {
  const now = new Date();
  const pad = (n) => String(n).padStart(2, '0');
  return `${pad(now.getDate())}/${pad(now.getMonth() + 1)} ${pad(now.getHours())}:${pad(now.getMinutes())}`;
}

function getSessionUser(socket) {
  try {
    const sid = socket.request.session?.userId;
    const sname = socket.request.session?.username;
    return sid ? { id: sid, username: sname } : null;
  } catch (err) {
    console.log('Error en getSessionUser:', err.message);
    return null;
  }
}

export default function registerChatHandlers(io, socket, userId) {
  function authGuard() {
    const su = getSessionUser(socket);
    if (!su) socket.emit('auth:me', null);
    return !!su;
  }

  function uid() {
    const su = getSessionUser(socket);
    return su ? su.id : userId;
  }

  socket.on('chat:sessions', async () => {
    try {
      if (!authGuard()) return;
      const sessions = await db('chat_sessions')
        .where({ user_id: uid() })
        .orderBy('updated_at', 'desc')
        .select('id', 'title', 'updated_at');
      socket.emit('chat:sessions_res', { sessions });
    } catch (err) {
      console.log('Error en chat:sessions:', err.message);
    }
  });

  socket.on('chat:create', async () => {
    try {
      if (!authGuard()) return;
      const title = generateTitle();
      const [id] = await db('chat_sessions').insert({ user_id: uid(), title });
      const session = await db('chat_sessions').where({ id }).first();
      socket.emit('chat:create_res', { session });
    } catch (err) {
      console.log('Error en chat:create:', err.message);
    }
  });

  socket.on('chat:load', async ({ sessionId }) => {
    try {
      if (!authGuard()) return;
      const messages = await db('chat_messages')
        .where({ session_id: sessionId })
        .orderBy('created_at', 'asc')
        .select('id', 'role', 'content', 'thinking', 'created_at');
      socket.emit('chat:load_res', { sessionId, messages });
    } catch (err) {
      console.log('Error en chat:load:', err.message);
    }
  });

  socket.on('chat:send', async ({ sessionId, message }) => {
    try {
      if (!authGuard()) return;
      await db('chat_messages').insert({ session_id: sessionId, role: 'user', content: message });
      await db('chat_sessions').where({ id: sessionId }).update({ updated_at: db.fn.now() });

      const history = await db('chat_messages')
        .where({ session_id: sessionId })
        .orderBy('created_at', 'asc')
        .select('role', 'content');

      const deepseekMessages = history.map((m) => ({ role: m.role, content: m.content }));

      let fullThinking = '';
      let fullResponse = '';

      for await (const chunk of streamChat(deepseekMessages)) {
        if (chunk.type === 'thinking') {
          fullThinking += chunk.content;
        } else {
          fullResponse += chunk.content;
        }
        socket.emit('chat:chunk', { sessionId, type: chunk.type, content: chunk.content });
      }

      await db('chat_messages').insert({
        session_id: sessionId,
        role: 'assistant',
        content: fullResponse,
        thinking: fullThinking || null,
      });
      await db('chat_sessions').where({ id: sessionId }).update({ updated_at: db.fn.now() });

      socket.emit('chat:done', { sessionId });

      const sessions = await db('chat_sessions')
        .where({ user_id: uid() })
        .orderBy('updated_at', 'desc')
        .select('id', 'title', 'updated_at');
      io.to(socket.id).emit('chat:sessions_res', { sessions });
    } catch (err) {
      console.log('Error en chat:send:', err.message);
      socket.emit('chat:chunk', { sessionId, type: 'response', content: `\n\n[Error: ${err.message}]` });
      socket.emit('chat:done', { sessionId });
    }
  });

  socket.on('chat:delete', async ({ sessionId }) => {
    try {
      if (!authGuard()) return;
      await db('chat_messages').where({ session_id: sessionId }).del();
      await db('chat_sessions').where({ id: sessionId }).del();
      const sessions = await db('chat_sessions')
        .where({ user_id: uid() })
        .orderBy('updated_at', 'desc')
        .select('id', 'title', 'updated_at');
      socket.emit('chat:sessions_res', { sessions });
      socket.emit('chat:delete_res', { success: true, sessionId });
    } catch (err) {
      console.log('Error en chat:delete:', err.message);
    }
  });
}
