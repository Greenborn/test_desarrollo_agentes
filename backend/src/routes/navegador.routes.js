import { Router } from 'express';
import playwrightManager from '../services/playwrightManager.js';

const router = Router();

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

router.get('/status', async (req, res) => {
  try {
    const running = await playwrightManager.isRunning();
    if (!running) {
      return res.json({ hasActiveSession: false });
    }
    const pwRes = await fetch(`${playwrightManager.baseUrl()}/api/status`);
    if (!pwRes.ok) {
      return res.json({ hasActiveSession: false });
    }
    const data = await pwRes.json();
    res.json(data);
  } catch (err) {
    console.log('Error al verificar estado del navegador:', err.message);
    res.json({ hasActiveSession: false });
  }
});

router.post('/command', async (req, res) => {
  if (!authGuard(req, res)) return;

  const { comando, parametros, sessionId } = req.body;
  if (!comando) {
    return res.status(400).json({ error: 'Campo "comando" es requerido' });
  }

  try {
    const commandText = `Navegador: ${comando}${parametros ? ' ' + JSON.stringify(parametros) : ''}`;

    await saveToChat(sessionId, 'command', `[navegador] ${comando}`);

    const pwParametros = (comando === 'start' || comando === 'start_event_recording') ? { ...parametros, chat_session_id: sessionId } : parametros;

    await playwrightManager.ensureRunning();
    playwrightManager.startKeepAlive();

    const pwRes = await fetch(`${playwrightManager.baseUrl()}/api/command`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ comando, parametros: pwParametros }),
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

  if (!id_session) {
    const errorMsg = 'No hay sesión de navegador activa. Usá /navegador_iniciar primero.';
    await saveToChat(sessionId, 'result', errorMsg);
    return res.status(400).json({ error: errorMsg });
  }

  try {
    await saveToChat(sessionId, 'command', '[navegador] finish');

    await playwrightManager.ensureRunning();

    const pwRes = await fetch(`${playwrightManager.baseUrl()}/api/command`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ comando: 'close', parametros: { id_session } }),
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
