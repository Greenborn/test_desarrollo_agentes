import { Router } from 'express';
import {
  testChatSessions,
  getChatMessages,
  sendChatMessage,
  executeChatCommand,
  createChatSession,
  listComandosPersonalizados,
  ejecutarComandoPersonalizadoRemoto,
} from './interfaz_remota.service.js';

// Rutas públicas (requieren sesión) consumidas por el frontend local
// (InterfazRemotaTab.vue). El estado de conexión/login/IO-log y las terminales remotas
// viven ahora en el servicio `interfaz_remota` (puerto SERVICIO_INTERFAZ_REMOTA_PORT):
// esas rutas se proxean por HTTP hacia allí. Las de chat/comandos personalizados siguen
// resueltas acá porque dependen del estado propio de este backend.

const router = Router();

function authGuard(req, res) {
  if (!req.session?.userId) {
    res.status(401).json({ error: 'No autorizado' });
    return false;
  }
  return true;
}

function interfazRemotaServiceUrl(path) {
  const port = process.env.SERVICIO_INTERFAZ_REMOTA_PORT;
  if (!port) return null;
  return `http://127.0.0.1:${port}${path}`;
}

async function proxyJson(req, res, path, { method = 'GET' } = {}) {
  const url = interfazRemotaServiceUrl(path);
  if (!url) {
    res.status(503).json({ error: 'Servicio interfaz_remota no configurado (SERVICIO_INTERFAZ_REMOTA_PORT)' });
    return;
  }
  try {
    const resp = await fetch(url, {
      method,
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': process.env.INTERFAZ_REMOTA_API_KEY,
      },
      body: method === 'GET' ? undefined : JSON.stringify(req.body || {}),
    });
    const data = await resp.json();
    res.status(resp.status).json(data);
  } catch (err) {
    console.log('[interfaz_remota] Error al proxear hacia el servicio interfaz_remota:', err.message);
    res.status(502).json({ error: 'Servicio interfaz_remota inalcanzable: ' + err.message });
  }
}

router.get('/status', (req, res) => {
  if (!authGuard(req, res)) return;
  proxyJson(req, res, '/status');
});

router.get('/events', (req, res) => {
  if (!authGuard(req, res)) return;
  const url = interfazRemotaServiceUrl('/events');
  if (!url) {
    res.status(503).end();
    return;
  }
  const controller = new AbortController();
  fetch(url, { headers: { 'x-api-key': process.env.INTERFAZ_REMOTA_API_KEY }, signal: controller.signal })
    .then((upstream) => {
      res.writeHead(200, {
        'Content-Type': 'text/event-stream',
        'Cache-Control': 'no-cache',
        'Connection': 'keep-alive',
        'X-Accel-Buffering': 'no',
      });
      upstream.body.pipe(res);
      req.on('close', () => controller.abort());
    })
    .catch((err) => {
      console.log('[interfaz_remota] Error al proxear eventos SSE:', err.message);
      res.status(502).end();
    });
});

router.post('/enable', (req, res) => {
  if (!authGuard(req, res)) return;
  proxyJson(req, res, '/enable', { method: 'POST' });
});

router.post('/disable', (req, res) => {
  if (!authGuard(req, res)) return;
  proxyJson(req, res, '/disable', { method: 'POST' });
});

router.post('/reconnect', (req, res) => {
  if (!authGuard(req, res)) return;
  proxyJson(req, res, '/reconnect', { method: 'POST' });
});

router.post('/test/chat-sessions', async (req, res) => {
  if (!authGuard(req, res)) return;
  const result = await testChatSessions();
  if (!result.success) {
    res.status(500).json(result);
    return;
  }
  res.json(result);
});

router.post('/test/get-messages', async (req, res) => {
  if (!authGuard(req, res)) return;
  const result = await getChatMessages(req.body || {});
  if (!result.success) {
    res.status(400).json(result);
    return;
  }
  res.json(result);
});

router.post('/test/send-message', async (req, res) => {
  if (!authGuard(req, res)) return;
  const result = await sendChatMessage(req.body || {});
  if (!result.success) {
    res.status(400).json(result);
    return;
  }
  res.json(result);
});

router.post('/test/send-command', async (req, res) => {
  if (!authGuard(req, res)) return;
  const result = await executeChatCommand(req.body || {});
  if (!result.success) {
    res.status(400).json(result);
    return;
  }
  res.json(result);
});

router.post('/test/crear-sesion', async (req, res) => {
  if (!authGuard(req, res)) return;
  const result = await createChatSession(req.body || {});
  if (!result.success) {
    res.status(400).json(result);
    return;
  }
  res.json(result);
});

router.post('/test/list-comandos', async (req, res) => {
  if (!authGuard(req, res)) return;
  const result = await listComandosPersonalizados(req.body || {});
  if (!result.success) {
    res.status(400).json(result);
    return;
  }
  res.json(result);
});

router.post('/test/ejecutar-comando', async (req, res) => {
  if (!authGuard(req, res)) return;
  const result = await ejecutarComandoPersonalizadoRemoto(req.body || {});
  if (!result.success) {
    res.status(400).json(result);
    return;
  }
  res.json(result);
});

router.post('/test/terminal/create', (req, res) => {
  if (!authGuard(req, res)) return;
  proxyJson(req, res, '/test/terminal/create', { method: 'POST' });
});

router.post('/test/terminal/input', (req, res) => {
  if (!authGuard(req, res)) return;
  proxyJson(req, res, '/test/terminal/input', { method: 'POST' });
});

router.post('/test/terminal/resize', (req, res) => {
  if (!authGuard(req, res)) return;
  proxyJson(req, res, '/test/terminal/resize', { method: 'POST' });
});

router.post('/test/terminal/close', (req, res) => {
  if (!authGuard(req, res)) return;
  proxyJson(req, res, '/test/terminal/close', { method: 'POST' });
});

router.post('/test/terminal/list', (req, res) => {
  if (!authGuard(req, res)) return;
  proxyJson(req, res, '/test/terminal/list', { method: 'POST' });
});

export default router;
