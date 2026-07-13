import { Router } from 'express';
import db from '../config/db.js';

const router = Router();

function authGuard(req, res) {
  if (!req.session?.userId) {
    res.status(401).json({ error: 'Sesión no válida' });
    return false;
  }
  return true;
}

async function getMaxSizeKb(wsId) {
  try {
    const row = await db('settings')
      .where({ workspace_id: wsId, setting_key: 'request_response_max_size_kb' })
      .select('setting_value')
      .first();
    if (row && row.setting_value) {
      return parseInt(row.setting_value, 10);
    }
  } catch (err) {
    console.log('[proxy] Error al leer max_size_kb:', err.message);
  }
  return 100;
}

router.post('/request', async (req, res) => {
  if (!authGuard(req, res)) return;

  const { url, method, headers, body } = req.body;

  if (!url || typeof url !== 'string') {
    return res.status(400).json({ error: 'URL es requerida.' });
  }

  let validatedUrl;
  try {
    validatedUrl = new URL(url);
    if (!['http:', 'https:'].includes(validatedUrl.protocol)) {
      return res.status(400).json({ error: 'Solo se permiten URLs HTTP/HTTPS.' });
    }
  } catch (err) { console.log('[proxy] Error al validar URL:', err.message);
    return res.status(400).json({ error: 'URL inválida.' });
  }

  const validMethods = ['GET', 'POST', 'PUT', 'DELETE', 'PATCH', 'HEAD', 'OPTIONS'];
  const methodUpper = (method || 'GET').toUpperCase();
  if (!validMethods.includes(methodUpper)) {
    return res.status(400).json({ error: `Método inválido: ${method}. Permitidos: ${validMethods.join(', ')}` });
  }

  const wsIds = req.session.workspaceIds || [1];
  const wsId = wsIds[0] || 1;
  const maxSizeKb = await getMaxSizeKb(wsId);
  const maxBytes = maxSizeKb * 1024;

  const reqHeaders = {};
  if (Array.isArray(headers)) {
    for (const h of headers) {
      if (h.key && h.key.trim()) {
        reqHeaders[h.key.trim()] = h.value || '';
      }
    }
  }

  let reqBody = null;
  if (body && methodUpper !== 'GET' && methodUpper !== 'HEAD' && methodUpper !== 'OPTIONS') {
    reqBody = body;
    if (!reqHeaders['content-type'] && !reqHeaders['Content-Type']) {
      try {
        JSON.parse(body);
        reqHeaders['Content-Type'] = 'application/json';
      } catch (err) { console.log('[proxy] Error al detectar content-type:', err.message);
        reqHeaders['Content-Type'] = 'text/plain';
      }
    }
  }

  if (reqHeaders['host'] || reqHeaders['Host']) {
    return res.status(400).json({ error: 'No se permite sobrescribir el header Host.' });
  }

  try {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 30000);

    const fetchOptions = {
      method: methodUpper,
      headers: reqHeaders,
      signal: controller.signal,
    };

    if (reqBody !== null) {
      fetchOptions.body = reqBody;
    }

    const startTime = Date.now();
    const response = await fetch(validatedUrl.toString(), fetchOptions);
    clearTimeout(timeout);
    const elapsed = Date.now() - startTime;

    const resHeaders = {};
    response.headers.forEach((val, key) => {
      resHeaders[key] = val;
    });

    let bodyBuffer = Buffer.from('');
    let truncated = false;
    let originalSize = 0;

    try {
      const reader = response.body.getReader();
      const chunks = [];
      let total = 0;

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        originalSize += value.length;
        if (total + value.length > maxBytes) {
          const remaining = maxBytes - total;
          if (remaining > 0) {
            chunks.push(value.slice(0, remaining));
          }
          truncated = true;
          break;
        }
        chunks.push(value);
        total += value.length;
      }

      bodyBuffer = Buffer.concat(chunks);
    } catch (readErr) {
      console.log('[proxy] Error al leer body:', readErr.message);
    }

    const decoder = new TextDecoder('utf-8', { fatal: false });
    const bodyText = decoder.decode(bodyBuffer);

    res.json({
      status: response.status,
      statusText: response.statusText,
      headers: resHeaders,
      body: bodyText,
      truncated,
      originalSize,
      bodySize: bodyBuffer.length,
      elapsed,
    });
  } catch (err) {
    console.log('[proxy] Error en petición:', err.message);
    if (err.name === 'AbortError') {
      return res.json({
        status: 0,
        statusText: 'Timeout',
        headers: {},
        body: '',
        truncated: false,
        originalSize: 0,
        bodySize: 0,
        elapsed: 30000,
        error: 'La petición excedió el tiempo de espera (30s).',
      });
    }
    return res.json({
      status: 0,
      statusText: 'Error',
      headers: {},
      body: '',
      truncated: false,
      originalSize: 0,
      bodySize: 0,
      elapsed: 0,
      error: err.message,
    });
  }
});

export default router;
