import { Router } from 'express';
import { emitToInterfazRemota } from './relayClient.js';
import {
  handleChatSessionsRequest,
  getChatMessagesCached,
  createChatSession,
  listComandosPersonalizados,
  listComponentes,
  componentInput,
  componentResize,
  stopComponentesSession,
  handleSendControl,
  runOpencodePromptSocket,
  sendChatMessageStreaming,
  executeChatCommandStreaming,
  ejecutarComandoPersonalizadoRemotoStreaming,
  makeRemotaHandler,
  makeStreamingHandler,
} from './interfaz_remota.service.js';

// Rutas internas (no públicas) que usa el servicio `interfaz_remota` para delegar en el
// backend principal los pseudoendpoints que dependen de su estado propio (DB de chat,
// streaming DeepSeek, comandos personalizados, opencode, componentHub/terminalBridge
// compartidos con la UI local). Protegidas con API key compartida, no con sesión.

const API_KEY = process.env.INTERFAZ_REMOTA_API_KEY;

function apiKeyAuth(req, res, next) {
  const token = req.headers['x-api-key'];
  if (!token || token !== API_KEY) {
    return res.status(401).json({ success: false, error: 'API key inválida' });
  }
  next();
}

const router = Router();
router.use(apiKeyAuth);

const relay = (event, payload) => emitToInterfazRemota(event, payload);

router.post('/chat-sessions', (req, res) => {
  handleChatSessionsRequest((resp) => res.json(resp));
});

router.post('/get-messages', (req, res) => {
  makeRemotaHandler((body) => getChatMessagesCached(body))(req.body, (resp) => res.json(resp));
});

router.post('/send-message', (req, res) => {
  makeStreamingHandler((body, emit) => sendChatMessageStreaming(body, emit), relay)(req.body, (resp) => res.json(resp));
});

router.post('/send-command', (req, res) => {
  makeStreamingHandler((body, emit) => executeChatCommandStreaming(body, emit), relay)(req.body, (resp) => res.json(resp));
});

router.post('/crear-sesion', (req, res) => {
  makeRemotaHandler((body) => createChatSession(body))(req.body, (resp) => res.json(resp));
});

router.post('/list-comandos', (req, res) => {
  makeRemotaHandler((body) => listComandosPersonalizados(body))(req.body, (resp) => res.json(resp));
});

router.post('/ejecutar-comando', (req, res) => {
  makeStreamingHandler((body, emit) => ejecutarComandoPersonalizadoRemotoStreaming(body, emit), relay)(req.body, (resp) => res.json(resp));
});

router.post('/opencode-send', (req, res) => {
  res.json(runOpencodePromptSocket(req.body, relay));
});

router.post('/send-control', (req, res) => {
  res.json(handleSendControl(req.body));
});

router.post('/componentes-list', (req, res) => {
  makeRemotaHandler((body) => listComponentes(body))(req.body, (resp) => res.json(resp));
});

router.post('/componentes-input', (req, res) => {
  makeRemotaHandler((body) => componentInput(body))(req.body, (resp) => res.json(resp));
});

router.post('/componentes-resize', (req, res) => {
  makeRemotaHandler((body) => componentResize(body))(req.body, (resp) => res.json(resp));
});

router.post('/componentes-stop', (req, res) => {
  makeRemotaHandler((body) => stopComponentesSession(body))(req.body, (resp) => res.json(resp));
});

export default router;
