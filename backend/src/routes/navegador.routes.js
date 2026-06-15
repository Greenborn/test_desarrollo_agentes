import { Router } from 'express';

const router = Router();
const PW_URL = `http://localhost:${process.env.SERVICIO_PLAYWRIGHT_PORT || 4098}`;

function authGuard(req, res) {
  if (!req.session?.userId) {
    res.status(401).json({ error: 'Sesión no válida' });
    return false;
  }
  return true;
}

async function saveToChat(sessionId, role, content) {
  if (!sessionId) return;
  try {
    const db = (await import('../config/db.js')).default;
    await db('chat_messages').insert({
      session_id: sessionId,
      role,
      content: typeof content === 'string' ? content : JSON.stringify(content),
    });
  } catch (err) {
    console.log('Error al guardar en chat_messages:', err.message);
  }
}

async function updateSessionTimestamp(sessionId) {
  if (!sessionId) return;
  try {
    const db = (await import('../config/db.js')).default;
    await db('chat_sessions').where({ id: sessionId }).update({ updated_at: db.fn.now() });
  } catch {}
}

router.post('/command', async (req, res) => {
  if (!authGuard(req, res)) return;

  const { comando, parametros, sessionId } = req.body;
  if (!comando) {
    return res.status(400).json({ error: 'Campo "comando" es requerido' });
  }

  try {
    const commandText = `Navegador: ${comando}${parametros ? ' ' + JSON.stringify(parametros) : ''}`;

    await saveToChat(sessionId, 'command', `[navegador] ${comando}`);

    const pwRes = await fetch(`${PW_URL}/api/command`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ comando, parametros }),
    });
    const data = await pwRes.json();

    if (data.error) {
      await saveToChat(sessionId, 'result', `Error: ${data.error}`);
    } else {
      const resultText = Object.entries(data)
        .map(([k, v]) => `${k}: ${v}`)
        .join('\n');
      await saveToChat(sessionId, 'result', resultText || JSON.stringify(data));
    }

    await updateSessionTimestamp(sessionId);
    res.status(pwRes.status).json(data);
  } catch (err) {
    console.log('Error al conectar con servicio playwright:', err.message);
    await saveToChat(sessionId, 'result', `Error de conexión: ${err.message}`);
    res.status(502).json({ error: 'Error al conectar con el servicio de navegador' });
  }
});

router.post('/finish', async (req, res) => {
  if (!authGuard(req, res)) return;

  const { id_session, sessionId } = req.body;

  try {
    let targetId = id_session;

    if (!targetId) {
      // Try to get active session from Playwright service
      try {
        const statusRes = await fetch(`${PW_URL}/api/command`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ comando: 'status', parametros: {} }),
        });
        const statusData = await statusRes.json();
        if (statusData.active) targetId = statusData.id;
      } catch {}
    }

    if (!targetId) {
      const errorMsg = 'No hay sesión de navegador activa. Usá /iniciar_navegador primero.';
      await saveToChat(sessionId, 'result', errorMsg);
      return res.status(400).json({ error: errorMsg });
    }

    await saveToChat(sessionId, 'command', '[navegador] finish');

    const pwRes = await fetch(`${PW_URL}/api/command`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ comando: 'close', parametros: { id_session: targetId } }),
    });
    const data = await pwRes.json();

    if (data.error) {
      await saveToChat(sessionId, 'result', `Error al cerrar navegador: ${data.error}`);
    } else {
      await saveToChat(sessionId, 'result', `Sesión de navegador cerrada: ${targetId}`);
    }

    await updateSessionTimestamp(sessionId);
    res.status(pwRes.status).json(data);
  } catch (err) {
    console.log('Error en navegador/finish:', err.message);
    await saveToChat(sessionId, 'result', `Error: ${err.message}`);
    res.status(500).json({ error: err.message });
  }
});

export default router;
