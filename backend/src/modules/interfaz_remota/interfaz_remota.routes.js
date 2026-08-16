import { Router } from 'express';
import {
  getInterfazRemotaStatus,
  setInterfazRemotaEnabled,
  enableInterfazRemota,
  testChatSessions,
  getInterfazRemotaIoLog,
  subscribeIoEvents,
} from './interfaz_remota.service.js';

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

export default router;
