import { Router } from 'express';
import http from 'http';

const router = Router();

const PROCESOS_HOST = 'localhost';
const PROCESOS_PORT = process.env.SERVICIO_PROCESOS_CONSOLA_PORT || 3575;
const PROCESOS_API_KEY = process.env.PROCESOS_CONSOLA_API_KEY || '';

function proxyRequest(req, res) {
  const targetPath = req.originalUrl.replace(/^\/api\/procesos/, '/api');
  const options = {
    hostname: PROCESOS_HOST,
    port: PROCESOS_PORT,
    path: targetPath,
    method: req.method,
    headers: {
      'Content-Type': 'application/json',
      'X-API-Key': PROCESOS_API_KEY,
    },
  };

  const proxyReq = http.request(options, (proxyRes) => {
    let data = '';
    proxyRes.on('data', (chunk) => { data += chunk; });
    proxyRes.on('end', () => {
      try {
        res.status(proxyRes.statusCode).json(JSON.parse(data));
      } catch {
        res.status(proxyRes.statusCode).send(data);
      }
    });
  });

  proxyReq.on('error', (err) => {
    res.status(502).json({ error: 'Error de conexión con api_procesos_consola', detail: err.message });
  });

  if (req.body && Object.keys(req.body).length > 0) {
    proxyReq.write(JSON.stringify(req.body));
  }
  proxyReq.end();
}

function authGuard(req, res, next) {
  if (!req.session?.userId) {
    return res.status(401).json({ error: 'Sesión no válida' });
  }
  next();
}

router.post('/terminal', authGuard, (req, res) => {
  const { cwd, cmd } = req.body;
  const chatSessionId = req.body.chatSessionId || req.session.activeSessionId;
  if (!chatSessionId) {
    return res.status(400).json({ error: 'chatSessionId es requerido' });
  }
  proxyRequest(req, res);
});

router.get('/terminal', authGuard, (req, res) => {
  proxyRequest(req, res);
});

router.delete('/terminal/:terminalId', authGuard, (req, res) => {
  proxyRequest(req, res);
});

router.delete('/terminal', authGuard, (req, res) => {
  proxyRequest(req, res);
});

export default router;
