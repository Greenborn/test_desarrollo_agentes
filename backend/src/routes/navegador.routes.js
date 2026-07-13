import { Router } from 'express';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import crypto from 'crypto';
import playwrightManager from '../services/playwrightManager.js';
import db from '../config/db.js';
import { STORAGE_DIR, ensureStorageDir } from './archivos.routes.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

const router = Router();

function authGuard(req, res) {
  if (!req.session?.userId) {
    res.status(401).json({ error: 'Sesión no válida' });
    return false;
  }
  return true;
}

async function saveToChat(sessionId, role, content) {
  if (!sessionId) return;
  try {
    const db = (await import('../config/db.js')).default;
    await db('chat_messages').insert({
      session_id: sessionId,
      role,
      content: typeof content === 'string' ? content : JSON.stringify(content),
    });
  } catch (err) {
    console.log('Error al guardar en chat_messages:', err.message);
  }
}

async function updateSessionTimestamp(sessionId) {
  if (!sessionId) return;
  try {
    const db = (await import('../config/db.js')).default;
    await db('chat_sessions').where({ id: sessionId }).update({ updated_at: db.fn.now() });
  } catch (err) { console.log('[navegador] Error al actualizar timestamp:', err.message); }
}

router.get('/status', async (req, res) => {
  try {
    const running = await playwrightManager.isRunning();
    if (!running) {
      return res.json({ hasActiveSession: false });
    }
    const pwRes = await fetch(`${playwrightManager.baseUrl()}/api/status`);
    if (!pwRes.ok) {
      return res.json({ hasActiveSession: false });
    }
    const data = await pwRes.json();
    if (data.hasActiveSession) {
      data.originalSessionId = data.chatSessionId || null;
    }
    res.json(data);
  } catch (err) {
    console.log('Error al verificar estado del navegador:', err.message);
    res.json({ hasActiveSession: false });
  }
});

router.post('/command', async (req, res) => {
  if (!authGuard(req, res)) return;

  const { comando, parametros, sessionId } = req.body;
  if (!comando) {
    return res.status(400).json({ error: 'Campo "comando" es requerido' });
  }

  try {
    // Determinar la sesión de chat a la que asociar los mensajes
    let targetSessionId = sessionId;

    // Para comandos que actúan sobre un navegador existente, obtener el chatSessionId original
    if (comando !== 'start' && comando !== 'close_all') {
      try {
        const statusRes = await fetch(`${playwrightManager.baseUrl()}/api/status`);
        if (statusRes.ok) {
          const statusData = await statusRes.json();
          if (statusData.hasActiveSession && statusData.chatSessionId) {
            targetSessionId = statusData.chatSessionId;
          }
        }
      } catch (err) {
        console.log('[navegador] Error al obtener status del navegador:', err.message);
      }
    }

    await saveToChat(targetSessionId, 'command', `[navegador] ${comando}`);

    const pwParametros = comando === 'start' ? { ...parametros, chat_session_id: sessionId } : parametros;

    await playwrightManager.ensureRunning();
    playwrightManager.startKeepAlive();

    const pwRes = await fetch(`${playwrightManager.baseUrl()}/api/command`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ comando, parametros: pwParametros }),
    });
    const data = await pwRes.json();

    // Indicar al frontend si la sesión destino difiere de la solicitada
    if (targetSessionId !== sessionId) {
      data.originalSessionId = targetSessionId;
    }

    if (data.error) {
      await saveToChat(targetSessionId, 'result', `Error: ${data.error}`);
    } else {
      const resultText = Object.entries(data)
        .map(([k, v]) => `${k}: ${v}`)
        .join('\n');
      await saveToChat(targetSessionId, 'result', resultText || JSON.stringify(data));
    }

    await updateSessionTimestamp(targetSessionId);
    res.status(pwRes.status).json(data);
  } catch (err) {
    console.log('Error al conectar con servicio playwright:', err.message);
    await saveToChat(targetSessionId || sessionId, 'result', `Error de conexión: ${err.message}`);
    res.status(502).json({ error: 'Error al conectar con el servicio de navegador' });
  }
});

router.post('/capturar-pantalla', async (req, res) => {
  if (!authGuard(req, res)) return;

  const { sessionId, fullpage } = req.body;

  if (!sessionId) {
    return res.status(400).json({ error: 'sessionId es requerido' });
  }

  try {
    const session = await db('chat_sessions').where({ id: sessionId }).first();
    if (!session) {
      return res.status(404).json({ error: 'Sesión de chat no encontrada' });
    }
    if (!session.proyecto_id) {
      return res.status(400).json({ error: 'La sesión de chat no está vinculada a un proyecto. Use /chat_set_proyecto primero.' });
    }

    const statusRes = await fetch(`${playwrightManager.baseUrl()}/api/status`);
    if (!statusRes.ok) {
      return res.status(502).json({ error: 'Servicio Playwright no disponible' });
    }
    const statusData = await statusRes.json();
    if (!statusData.hasActiveSession) {
      return res.status(400).json({ error: 'No hay sesión de navegador activa. Use /navegador_iniciar primero.' });
    }

    await playwrightManager.ensureRunning();

    const pwRes = await fetch(`${playwrightManager.baseUrl()}/api/command`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        comando: 'take_screenshot',
        parametros: { fullpage: fullpage === true || fullpage === 'true' },
      }),
    });
    const pwData = await pwRes.json();

    if (pwData.error) {
      await saveToChat(sessionId, 'result', `Error al capturar pantalla: ${pwData.error}`);
      return res.status(500).json({ error: pwData.error });
    }

    const imageBuffer = Buffer.from(pwData.image_base64, 'base64');
    ensureStorageDir();

    const uuid = crypto.randomUUID();
    const nombreStorage = `${uuid}_screenshot.png`;
    const filePath = path.join(STORAGE_DIR, nombreStorage);
    fs.writeFileSync(filePath, imageBuffer);

    const [archivoId] = await db('archivos').insert({
      proyecto_id: session.proyecto_id,
      chat_session_id: sessionId,
      nombre_original: `screenshot_${new Date().toISOString().slice(0, 19).replace(/[^0-9]/g, '_')}.png`,
      nombre_storage: nombreStorage,
      tipo: 'image/png',
      tamano: imageBuffer.length,
    });

    const archivo = await db('archivos').where({ id: archivoId }).first();

    // Capturar HTML de la página y guardarlo como metadata
    try {
      const htmlRes = await fetch(`${playwrightManager.baseUrl()}/api/command`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ comando: 'get_page_html', parametros: {} }),
      });
      const htmlData = await htmlRes.json();
      if (!htmlData.error && htmlData.html) {
        await db('capturas_metadata').insert({
          archivo_id: archivoId,
          key: 'page_html',
          value: htmlData.html,
        });
      }
    } catch (htmlErr) {
      console.log('[navegador] Error al capturar HTML:', htmlErr.message);
    }

    // Capturar inputs detectados y guardarlos como metadata
    try {
      const inputsRes = await fetch(`${playwrightManager.baseUrl()}/api/command`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ comando: 'extract_form_controls', parametros: {} }),
      });
      const inputsData = await inputsRes.json();
      if (!inputsData.error && inputsData.controls) {
        await db('capturas_metadata').insert({
          archivo_id: archivoId,
          key: 'detected_inputs',
          value: JSON.stringify({
            controls: inputsData.controls,
            forms: inputsData.forms,
            url: inputsData.url,
            title: inputsData.title,
            scrollX: inputsData.scrollX,
            scrollY: inputsData.scrollY,
            viewportWidth: inputsData.viewportWidth,
            viewportHeight: inputsData.viewportHeight,
            pageWidth: inputsData.pageWidth,
            pageHeight: inputsData.pageHeight,
          }),
        });
      }
    } catch (inputsErr) {
      console.log('[navegador] Error al capturar inputs detectados:', inputsErr.message);
    }

    await saveToChat(sessionId, 'command', '[navegador] capturar_pantalla');
    await saveToChat(sessionId, 'result',
      `Captura de pantalla guardada:\n` +
      `  ID: ${archivo.id}\n` +
      `  Nombre: ${archivo.nombre_original}\n` +
      `  Tamaño: ${(archivo.tamano / 1024).toFixed(1)} KB\n` +
      `  Proyecto: ${archivo.proyecto_id}\n` +
      `  Fecha: ${archivo.created_at}`
    );

    await updateSessionTimestamp(sessionId);
    res.json({ success: true, archivo });
  } catch (err) {
    console.log('Error en navegador/capturar-pantalla:', err.message);
    await saveToChat(sessionId, 'result', `Error: ${err.message}`);
    res.status(500).json({ error: err.message });
  }
});

router.post('/finish', async (req, res) => {
  if (!authGuard(req, res)) return;

  const { id_session, sessionId } = req.body;

  // Determinar sesión origen del navegador
  let targetSessionId = sessionId;
  try {
    const statusRes = await fetch(`${playwrightManager.baseUrl()}/api/status`);
    if (statusRes.ok) {
      const statusData = await statusRes.json();
      if (statusData.hasActiveSession && statusData.chatSessionId) {
        targetSessionId = statusData.chatSessionId;
      }
    }
  } catch (err) {
    console.log('[navegador] Error al obtener status del navegador:', err.message);
  }

  if (!id_session) {
    const errorMsg = 'No hay sesión de navegador activa. Usá /navegador_iniciar primero.';
    await saveToChat(targetSessionId, 'result', errorMsg);
    return res.status(400).json({ error: errorMsg });
  }

  try {
    await saveToChat(targetSessionId, 'command', '[navegador] finish');

    await playwrightManager.ensureRunning();

    const pwRes = await fetch(`${playwrightManager.baseUrl()}/api/command`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ comando: 'close', parametros: { id_session } }),
    });
    const data = await pwRes.json();

    if (data.error) {
      await saveToChat(targetSessionId, 'result', `Error al cerrar navegador: ${data.error}`);
    } else {
      await saveToChat(targetSessionId, 'result', `Sesión de navegador cerrada: ${id_session}`);
    }

    await updateSessionTimestamp(targetSessionId);
    res.status(pwRes.status).json(data);
  } catch (err) {
    console.log('Error en navegador/finish:', err.message);
    await saveToChat(targetSessionId, 'result', `Error: ${err.message}`);
    res.status(500).json({ error: err.message });
  }
});

export default router;
