import { Router } from 'express';
import {
  getInterfazRemotaStatus,
  setInterfazRemotaEnabled,
  enableInterfazRemota,
  testChatSessions,
  getChatMessages,
  sendChatMessage,
  executeChatCommand,
  createChatSession,
  listComandosPersonalizados,
  ejecutarComandoPersonalizadoRemoto,
  getInterfazRemotaIoLog,
  subscribeIoEvents,
} from './interfaz_remota.service.js';
import {
  createRemoteTerminal,
  writeRemoteTerminal,
  resizeRemoteTerminal,
  closeRemoteTerminal,
  listRemoteTerminals,
} from './remoteTerminal.js';

const router = Router();

function authGuard(req, res) {
  if (!req.session?.userId) {
    res.status(401).json({ error: 'No autorizado' });
    return false;
  }
  return true;
}

router.get('/status', (req, res) => {
  if (!authGuard(req, res)) return;
  const state = getInterfazRemotaStatus();
  res.json(state);
});

router.get('/events', (req, res) => {
  if (!authGuard(req, res)) return;

  res.writeHead(200, {
    'Content-Type': 'text/event-stream',
    'Cache-Control': 'no-cache',
    'Connection': 'keep-alive',
    'X-Accel-Buffering': 'no',
  });

  res.write(`retry: 3000\n\n`);
  res.write(`data: ${JSON.stringify({ type: 'snapshot', ioLog: getInterfazRemotaIoLog() })}\n\n`);

  const unsubscribe = subscribeIoEvents(res);

  req.on('close', () => {
    unsubscribe();
    try {
      res.end();
    } catch (err) {
      console.log('[interfaz_remota] error al cerrar stream SSE:', err.message);
    }
  });

  req.on('error', (err) => {
    console.log('[interfaz_remota] error en stream SSE:', err.message);
    unsubscribe();
  });
});

router.post('/enable', async (req, res) => {
  if (!authGuard(req, res)) return;
  try {
    await enableInterfazRemota();
    res.json(getInterfazRemotaStatus());
  } catch (err) {
    console.log('[interfaz_remota] Error al habilitar conexión:', err.message);
    res.status(500).json({ error: err.message });
  }
});

router.post('/disable', (req, res) => {
  if (!authGuard(req, res)) return;
  setInterfazRemotaEnabled(false);
  res.json(getInterfazRemotaStatus());
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

router.post('/test/terminal/create', async (req, res) => {
  if (!authGuard(req, res)) return;
  const result = createRemoteTerminal(req.body || {});
  if (!result.success) {
    res.status(400).json(result);
    return;
  }
  res.json(result);
});

router.post('/test/terminal/input', async (req, res) => {
  if (!authGuard(req, res)) return;
  const result = writeRemoteTerminal(req.body || {});
  if (!result.success) {
    res.status(400).json(result);
    return;
  }
  res.json(result);
});

router.post('/test/terminal/resize', async (req, res) => {
  if (!authGuard(req, res)) return;
  const result = resizeRemoteTerminal(req.body || {});
  if (!result.success) {
    res.status(400).json(result);
    return;
  }
  res.json(result);
});

router.post('/test/terminal/close', async (req, res) => {
  if (!authGuard(req, res)) return;
  const result = closeRemoteTerminal(req.body || {});
  if (!result.success) {
    res.status(400).json(result);
    return;
  }
  res.json(result);
});

router.post('/test/terminal/list', async (req, res) => {
  if (!authGuard(req, res)) return;
  const result = listRemoteTerminals(req.body || {});
  if (!result.success) {
    res.status(400).json(result);
    return;
  }
  res.json(result);
});

export default router;
