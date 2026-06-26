import { Router } from 'express';
import browserManager from '../services/browserManager.js';

const router = Router();

router.get('/health', (req, res) => {
  res.json({ status: 'ok' });
});

router.get('/status', (req, res) => {
  const active = browserManager.getActiveSession();
  res.json({ hasActiveSession: !!active });
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
        const instanceName = parametros?.instance_name;
        const idSession = await browserManager.startSession(navegador, headless, resolution, chatSessionId, instanceName);
        if (url) {
          await browserManager.goToUrl(idSession, url);
        }
        return res.json({ id_session: idSession, headless: !!headless, url: url || null, resolution: resolution || null, chat_session_id: chatSessionId || null, instance_name: instanceName || null });
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

      const active = browserManager.getActiveSession();
      if (active) {
        const { id, navegador, chatSessionId, instanceName } = active;
        await browserManager.closeSession(id);
        const newId = await browserManager.startSession(navegador, value, null, chatSessionId, instanceName);
        return res.json({ success: true, reiniciado: true, id_session: newId, headless: value });
      }

      return res.json({ success: true, reiniciado: false, headless: value });
    }

    if (comando === 'extract_form_controls') {
      let idSession = parametros?.id_session;
      if (!idSession) {
        const active = browserManager.getActiveSession();
        if (active) idSession = active.id;
      }
      if (!idSession) {
        return res.status(400).json({
          error: 'No hay sesión activa. Usá "start" primero o pasá "id_session"',
        });
      }

      try {
        const data = await browserManager.extractFormControls(idSession);
        return res.json({ success: true, id_session: idSession, ...data });
      } catch (err) {
        return res.status(500).json({ error: err.message });
      }
    }

    if (comando === 'start_event_recording') {
      let idSession = parametros?.id_session;
      if (!idSession) {
        const active = browserManager.getActiveSession();
        if (active) idSession = active.id;
      }
      if (!idSession) {
        return res.status(400).json({
          error: 'No hay sesión activa. Usá "start" primero o pasá "id_session"',
        });
      }

      const session = browserManager.getSession(idSession);
      if (!session) {
        return res.status(404).json({ error: `Sesión no encontrada: "${idSession}"` });
      }

      try {
        const chatSessionId = parametros?.chat_session_id || session.chatSessionId;
        const recordingId = parametros?.recording_id || null;
        browserManager.setupEventRecording(session.page, idSession, chatSessionId, recordingId);
        return res.json({ success: true, id_session: idSession, recording: true, recording_id: recordingId });
      } catch (err) {
        return res.status(500).json({ error: err.message });
      }
    }

    if (comando === 'stop_event_recording') {
      let idSession = parametros?.id_session;
      if (!idSession) {
        const active = browserManager.getActiveSession();
        if (active) idSession = active.id;
      }
      if (!idSession) {
        return res.status(400).json({
          error: 'No hay sesión activa. Usá "start" primero o pasá "id_session"',
        });
      }

      const session = browserManager.getSession(idSession);
      if (!session) {
        return res.status(404).json({ error: `Sesión no encontrada: "${idSession}"` });
      }

      try {
        browserManager.stopEventRecording(session.page);
        return res.json({ success: true, id_session: idSession, recording: false });
      } catch (err) {
        return res.status(500).json({ error: err.message });
      }
    }

    if (comando === 'execute_action') {
      let idSession = parametros?.id_session;
      if (!idSession) {
        const active = browserManager.getActiveSession();
        if (active) idSession = active.id;
      }
      if (!idSession) {
        return res.status(400).json({
          error: 'No hay sesión activa. Usá "start" primero o pasá "id_session"',
        });
      }

      const action = parametros?.action;
      if (!action) {
        return res.status(400).json({ error: 'Parámetro "action" es requerido' });
      }

      try {
        const result = await browserManager.executeAction(idSession, action);
        return res.json({ success: true, id_session: idSession, ...result });
      } catch (err) {
        return res.status(500).json({ error: err.message });
      }
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
