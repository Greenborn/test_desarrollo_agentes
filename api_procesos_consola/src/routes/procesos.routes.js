import { Router } from 'express';
import * as terminalManager from '../services/terminalManager.js';

const router = Router();

router.get('/health', (req, res) => {
  res.json({ status: 'ok', service: 'api_procesos_consola' });
});

router.post('/terminal', (req, res) => {
  const { chatSessionId, cwd, cmd } = req.body;

  if (!chatSessionId) {
    return res.status(400).json({ error: 'chatSessionId es requerido' });
  }

  const terminalId = terminalManager.createTerminalRecord({ chatSessionId, cwd, cmd });
  const host = req.headers.host || `localhost:${process.env.SERVICIO_PROCESOS_CONSOLA_PORT || 3575}`;

  res.json({ terminalId, wsUrl: `ws://${host}?terminalId=${terminalId}` });
});

router.get('/terminal', (req, res) => {
  const { chatSessionId } = req.query;
  const terminals = terminalManager.listTerminals(chatSessionId || undefined);
  console.log(`[procesos_consola] GET /terminal chatSessionId=${chatSessionId} encontrados=${terminals.length} total=${terminalManager.listTerminals().length}`);

  const safe = terminals.map((t) => ({
    terminalId: t.terminalId,
    chatSessionId: t.chatSessionId,
    cwd: t.cwd,
    cmd: t.cmd,
    pid: t.pid || null,
    status: t.status,
    createdAt: t.createdAt,
    activatedAt: t.activatedAt || null,
  }));

  res.json(safe);
});

router.delete('/terminal/:terminalId', async (req, res) => {
  const { terminalId } = req.params;
  const closed = await terminalManager.closeTerminal(terminalId);
  if (!closed) {
    return res.status(404).json({ error: 'terminal no encontrado' });
  }
  res.json({ terminalId, status: 'closed' });
});

router.delete('/terminal', async (req, res) => {
  const { chatSessionId } = req.query;

  if (!chatSessionId) {
    return res.status(400).json({ error: 'chatSessionId es requerido' });
  }

  const closed = await terminalManager.closeTerminalsBySession(chatSessionId);
  res.json({ closed: closed.length });
});

export default router;
