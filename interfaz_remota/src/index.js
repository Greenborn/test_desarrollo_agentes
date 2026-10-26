import express from 'express';
import {
  initInterfazRemotaLogin,
  stopInterfazRemotaWs,
  getInterfazRemotaStatus,
  setInterfazRemotaEnabled,
  enableInterfazRemota,
  reconnectInterfazRemota,
  getInterfazRemotaIoLog,
  subscribeIoEvents,
  emitIfConnected,
} from './socketClient.js';
import {
  createRemoteTerminal,
  writeRemoteTerminal,
  resizeRemoteTerminal,
  closeRemoteTerminal,
  listRemoteTerminals,
} from './remoteTerminal.js';

const PORT = process.env.SERVICIO_INTERFAZ_REMOTA_PORT;
if (!PORT) {
  console.log('SERVICIO_INTERFAZ_REMOTA_PORT no está definido en .env');
  process.exit(1);
}

const API_KEY = process.env.INTERFAZ_REMOTA_API_KEY;
if (!API_KEY) {
  console.log('INTERFAZ_REMOTA_API_KEY no está definida en .env');
  process.exit(1);
}

function apiKeyAuth(req, res, next) {
  const token = req.headers['x-api-key'];
  if (!token || token !== API_KEY) {
    return res.status(401).json({ success: false, error: 'API key inválida' });
  }
  next();
}

const app = express();
app.use(express.json({ limit: '10mb' }));

app.get('/status', apiKeyAuth, (req, res) => {
  res.json(getInterfazRemotaStatus());
});

app.get('/events', apiKeyAuth, (req, res) => {
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
    try { res.end(); } catch (err) { /* ya cerrado */ }
  });
  req.on('error', () => unsubscribe());
});

app.post('/enable', apiKeyAuth, async (req, res) => {
  try {
    await enableInterfazRemota();
    res.json(getInterfazRemotaStatus());
  } catch (err) {
    console.log('[interfaz_remota] Error al habilitar conexión:', err.message);
    res.status(500).json({ error: err.message });
  }
});

app.post('/disable', apiKeyAuth, (req, res) => {
  setInterfazRemotaEnabled(false);
  res.json(getInterfazRemotaStatus());
});

app.post('/reconnect', apiKeyAuth, async (req, res) => {
  try {
    await reconnectInterfazRemota();
    res.json(getInterfazRemotaStatus());
  } catch (err) {
    console.log('[interfaz_remota] Error al reconectar:', err.message);
    res.status(500).json({ error: err.message });
  }
});

// Endpoint que usa el backend principal para reenviar hacia la gestión interna los
// eventos de streaming (chat, opencode, componentes) cuyo estado vive en el backend.
app.post('/internal/relay', apiKeyAuth, (req, res) => {
  const { event, payload } = req.body || {};
  if (!event || typeof event !== 'string') {
    return res.status(400).json({ success: false, error: 'event requerido' });
  }
  const ok = emitIfConnected(event, payload);
  res.json({ success: ok, error: ok ? undefined : 'Socket no conectado a la gestión interna' });
});

// Rutas de prueba manual de terminales remotas (equivalentes a las que exponía el
// backend principal antes de que las terminales remotas se movieran a este servicio).
app.post('/test/terminal/create', apiKeyAuth, (req, res) => {
  const result = createRemoteTerminal(req.body || {});
  res.status(result.success ? 200 : 400).json(result);
});
app.post('/test/terminal/input', apiKeyAuth, (req, res) => {
  const result = writeRemoteTerminal(req.body || {});
  res.status(result.success ? 200 : 400).json(result);
});
app.post('/test/terminal/resize', apiKeyAuth, (req, res) => {
  const result = resizeRemoteTerminal(req.body || {});
  res.status(result.success ? 200 : 400).json(result);
});
app.post('/test/terminal/close', apiKeyAuth, (req, res) => {
  const result = closeRemoteTerminal(req.body || {});
  res.status(result.success ? 200 : 400).json(result);
});
app.post('/test/terminal/list', apiKeyAuth, (req, res) => {
  const result = listRemoteTerminals(req.body || {});
  res.status(result.success ? 200 : 400).json(result);
});

const server = app.listen(PORT, (err) => {
  if (err) {
    console.log('Error al iniciar servicio interfaz_remota:', err.message);
    process.exit(1);
  }
  console.log(`Servicio interfaz_remota escuchando en el puerto ${PORT}`);
  initInterfazRemotaLogin();
});

process.on('uncaughtException', (err, origin) => {
  console.log('[interfaz_remota] UNCAUGHT EXCEPTION:', err.message, '\n', err.stack, '\norigin:', origin);
});

process.on('unhandledRejection', (reason) => {
  console.log('[interfaz_remota] UNHANDLED REJECTION:', reason instanceof Error ? reason.message : reason);
});

function shutdown() {
  stopInterfazRemotaWs();
  server.close();
}

process.on('exit', shutdown);
process.on('SIGTERM', () => { shutdown(); process.exit(0); });
process.on('SIGINT', () => { shutdown(); process.exit(0); });
