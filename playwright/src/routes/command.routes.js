import { Router } from 'express';
import browserManager from '../services/browserManager.js';

const router = Router();

router.get('/health', (req, res) => {
  res.json({ status: 'ok' });
});

router.post('/command', async (req, res) => {
  try {
    const { comando, parametros } = req.body;

    if (!comando) {
      return res.status(400).json({ error: 'Campo "comando" es requerido' });
    }

    if (comando === 'start') {
      const navegador = parametros?.navegador;
      if (!navegador) {
        return res.status(400).json({ error: 'Parámetro "navegador" es requerido' });
      }

      try {
        const headless = parametros?.headless;
        const url = parametros?.url;
        const resolution = parametros?.resolution;
        const chatSessionId = parametros?.chat_session_id;
        const idSession = await browserManager.startSession(navegador, headless, resolution, chatSessionId);
        if (url) {
          await browserManager.goToUrl(idSession, url);
        }
        return res.json({ id_session: idSession, headless: !!headless, url: url || null, resolution: resolution || null, chat_session_id: chatSessionId || null });
      } catch (err) {
        return res.status(500).json({ error: err.message });
      }
    }

    if (comando === 'go_to_url') {
      let idSession = parametros?.id_session;
      const url = parametros?.url;
      if (!idSession) {
        const active = browserManager.getActiveSession();
        if (active) idSession = active.id;
      }

      if (!idSession) {
        return res.status(400).json({ error: 'No hay sesión activa. Usá "start" primero o pasá "id_session"' });
      }
      if (!url) {
        return res.status(400).json({ error: 'Parámetro "url" es requerido' });
      }

      try {
        await browserManager.goToUrl(idSession, url);
        return res.json({ success: true, id_session: idSession });
      } catch (err) {
        return res.status(500).json({ error: err.message });
      }
    }

    if (comando === 'set_headless') {
      const headless = parametros?.headless;
      if (headless === undefined || headless === null) {
        return res.status(400).json({ error: 'Parámetro "headless" es requerido (0 o 1)' });
      }

      const value = headless === true || headless === '1' || headless === 1;
      browserManager.setDefaultHeadless(value);

      // If there's an active session, restart it with the new headless mode
      const active = browserManager.getActiveSession();
      if (active) {
        const { id, navegador, chatSessionId } = active;
        await browserManager.closeSession(id);
        const newId = await browserManager.startSession(navegador, value, null, chatSessionId);
        return res.json({ success: true, reiniciado: true, id_session: newId, headless: value });
      }

      return res.json({ success: true, reiniciado: false, headless: value });
    }

    if (comando === 'close') {
      const idSession = parametros?.id_session;
      if (!idSession) {
        return res.status(400).json({ error: 'Parámetro "id_session" es requerido' });
      }

      browserManager.closeSession(idSession);
      return res.json({ success: true });
    }

    return res.status(400).json({ error: `Comando desconocido: "${comando}"` });
  } catch (err) {
    console.log('Error en /api/command:', err.message);
    return res.status(500).json({ error: err.message });
  }
});

export default router;
