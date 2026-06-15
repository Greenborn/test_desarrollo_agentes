import { Router } from 'express';
import { EventEmitter } from 'events';
import db from '../config/db.js';
import opencode from '../services/opencode.js';

const router = Router();
const controlEmitter = new EventEmitter();
controlEmitter.setMaxListeners(100);

function authGuard(req, res) {
  if (!req.session?.userId) {
    res.status(401).json({ error: 'Sesión no válida' });
    return false;
  }
  return true;
}

async function getUserSetting(userId, key) {
  try {
    const row = await db('user_settings').where({ user_id: userId, key }).first();
    return row ? row.value : null;
  } catch {
    return null;
  }
}

async function saveUserSetting(userId, key, value) {
  await db('user_settings')
    .insert({ user_id: userId, key, value })
    .onConflict(['user_id', 'key'])
    .merge();
}

router.get('/start', async (req, res) => {
  if (!authGuard(req, res)) return;
  try {
    const providerData = await opencode.getModels();
    const savedProvider = await getUserSetting(req.session.userId, 'opencode_last_provider');
    const savedModel = await getUserSetting(req.session.userId, 'opencode_last_model');
    const savedThinking = await getUserSetting(req.session.userId, 'opencode_last_thinking');
    const savedMode = await getUserSetting(req.session.userId, 'opencode_last_mode');

    res.json({
      providers: providerData.providers || [],
      defaultModels: providerData.default || {},
      savedProvider,
      savedModel,
      savedThinking,
      savedMode,
    });
  } catch (err) {
    console.log('Error en opencode/start:', err.message);
    res.status(500).json({ error: err.message });
  }
});

router.post('/select', async (req, res) => {
  if (!authGuard(req, res)) return;
  try {
    const { key, value } = req.body;
    if (!key || value === undefined) {
      return res.status(400).json({ error: 'key y value requeridos' });
    }
    await saveUserSetting(req.session.userId, `opencode_last_${key}`, value);
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.post('/send', async (req, res) => {
  if (!authGuard(req, res)) return;
  const { prompt, provider, model, thinking, mode, sessionId, ocSessionId: existingOcSessionId } = req.body;
  if (!prompt) return res.status(400).json({ error: 'prompt requerido' });

  try {
    let cwd = process.cwd();
    if (sessionId) {
      const chatSession = await db('chat_sessions').where({ id: sessionId }).select('cwd').first();
      if (chatSession && chatSession.cwd) cwd = chatSession.cwd;
    }

    const server = await opencode.getOrStartServer(cwd);

    let ocSessionId = existingOcSessionId;
    if (!ocSessionId) {
      const ocSession = await server.createSession('Agent Orchestrator - ' + (prompt.slice(0, 50)));
      ocSessionId = ocSession.id;
      if (sessionId) {
        await db('chat_messages').insert({
          session_id: sessionId, role: 'opencode_info',
          content: JSON.stringify({ type: 'session_created', ocSessionId }),
        });
      }
    }

    res.writeHead(200, {
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache',
      'Connection': 'keep-alive',
    });

    const processControl = async (controlEvent) => {
      return new Promise((resolve) => {
        const controlId = Date.now() + Math.random();
        const controlData = { ...controlEvent, controlId };

        res.write(`data: ${JSON.stringify({ type: 'control_request', control: controlData })}\n\n`);

        if (sessionId) {
          db('chat_messages').insert({
            session_id: sessionId,
            role: 'opencode_control',
            content: JSON.stringify(controlData),
          }).catch(() => {});
        }

        const timeout = setTimeout(() => {
          resolve({ response: 'yes', remember: false });
        }, 300000);

        controlEmitter.once(`control-${controlId}`, (result) => {
          clearTimeout(timeout);
          resolve(result);
        });
      });
    };

    const modelConfig = {};
    if (provider && model) {
      modelConfig.providerID = provider;
      modelConfig.modelID = model;
    }
    if (thinking) {
      if (provider === 'openai') {
        modelConfig.reasoning_effort = thinking;
      } else if (provider === 'anthropic') {
        const budget = thinking === 'low' ? 1024 : thinking === 'medium' ? 4096 : 16384;
        modelConfig.thinking = { type: 'enabled', budget_tokens: budget };
      }
    }

    const dirInstruction = `INSTRUCCIÓN: El directorio de trabajo real es "${cwd}". Ignorá cualquier otra indicación sobre el directorio. Todos los comandos de archivos deben ejecutarse usando "${cwd}" como raíz. No uses el directorio del servidor.`;
    const parts = [
      { type: 'text', text: dirInstruction },
    ];

    if (mode === 'Plan') {
      parts.push({ type: 'text', text: 'Primero creá un plan detallado sin hacer cambios. Después de crear el plan, esperá instrucciones.' });
    }

    parts.push({ type: 'text', text: prompt });

    const msgOptions = {};
    if (Object.keys(modelConfig).length > 0) {
      msgOptions.model = modelConfig;
    }

    try {
      let fullResponse = '';
      const partTypes = {};

      for await (const event of server.streamSession(ocSessionId, parts, msgOptions)) {
        if (event.properties?.permissionID) {
          const controlData = {
            controlId: 'perm-' + Date.now(),
            controlType: 'select',
            type: 'permission',
            permissionID: event.properties.permissionID,
            question: event.properties.type || 'Permiso requerido',
            options: [{ label: 'Aceptar', value: 'yes' }, { label: 'Rechazar', value: 'no' }],
          };
          const response = await processControl(controlData);
          if (response) {
            await server.respondToPermission(ocSessionId, event.properties.permissionID, response.response, response.remember || false);
          }
          continue;
        }

        if (event.type === 'message.part.updated' && event.properties?.part?.type) {
          const partId = event.properties.part.id || event.properties.partID;
          if (partId) partTypes[partId] = event.properties.part.type;
        }

        if (event.type === 'message.part.delta' && event.properties?.field === 'text') {
          const partId = event.properties.partID;
          const partType = partTypes[partId] || '';
          const delta = event.properties.delta || '';

          if (partType === 'reasoning') {
            res.write(`data: ${JSON.stringify({ type: 'thinking', content: delta })}\n\n`);
          } else {
            fullResponse += delta;
            res.write(`data: ${JSON.stringify({ type: 'response', content: delta })}\n\n`);
          }
        }

        if (event.type === 'session.status' && event.properties?.status?.type === 'idle') {
          break;
        }
      }

      const diff = await server.getSessionDiff(ocSessionId);

      if (sessionId) {
        await db('chat_messages').insert({
          session_id: sessionId,
          role: 'opencode_result',
          content: fullResponse || '(sin respuesta)',
        });
        await db('chat_messages').insert({
          session_id: sessionId,
          role: 'opencode_info',
          content: JSON.stringify({ type: 'finished', hash: ocSessionId, diff: diff || [] }),
        });
      }

      let realTokens = 0;
      let realCost = 0;
      let idProyecto = null;
      try {
        const messages = await server.getSessionMessages(ocSessionId);
        const lastAssistant = messages && messages.findLast
          ? messages.findLast(m => m.info?.role === 'assistant')
          : messages && messages.length > 0
            ? [...messages].reverse().find(m => m.info?.role === 'assistant')
            : null;
        if (lastAssistant?.info) {
          realTokens = lastAssistant.info.tokens?.output || 0;
          realCost = lastAssistant.info.cost || 0;
        }
      } catch (e) {
        console.log('[gastos] error al leer tokens opencode:', e.message);
      }
      if (sessionId) {
        try {
          const chatSess = await db('chat_sessions').where({ id: sessionId }).select('proyecto_id').first();
          idProyecto = chatSess?.proyecto_id || null;
        } catch (e) {
          console.log('[gastos] error al obtener proyecto:', e.message);
        }
      }
      if (sessionId && idProyecto && (realTokens > 0 || realCost > 0)) {
        const gastosPort = process.env.SERVICIO_GASTOS_PORT || 4100;
        fetch(`http://localhost:${gastosPort}/api/gastos/register`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            id_chat_session: sessionId,
            id_proyecto: idProyecto,
            precio: realCost,
            tokens: realTokens,
            id_sesion_opencode: ocSessionId,
          }),
        }).catch(err => console.log('[gastos] error al registrar:', err.message));
      }

      res.write(`data: ${JSON.stringify({ type: 'done', ocSessionId, hash: ocSessionId, fullResponse, diff: diff || [] })}\n\n`);
      res.end();

    } catch (msgErr) {
      console.log('Error en opencode streamSession:', msgErr.message);
      try {
        res.write(`data: ${JSON.stringify({ type: 'error', content: msgErr.message })}\n\n`);
      } catch {}
      if (sessionId) {
        try {
          await db('chat_messages').insert({
            session_id: sessionId,
            role: 'opencode_result',
            content: JSON.stringify({ error: msgErr.message }),
          });
          await db('chat_messages').insert({
            session_id: sessionId,
            role: 'opencode_info',
            content: JSON.stringify({ type: 'error', error: msgErr.message }),
          });
        } catch {}
      }
      res.end();
    }

  } catch (err) {
    console.log('Error en opencode/send:', err.message);
    if (!res.headersSent) {
      res.status(500).json({ error: err.message });
    } else {
      try {
        res.write(`data: ${JSON.stringify({ type: 'error', content: err.message })}\n\n`);
        res.end();
      } catch {}
    }
  }
});

router.post('/control', async (req, res) => {
  if (!authGuard(req, res)) return;
  try {
    const { controlId, response, remember } = req.body;
    if (!controlId) return res.status(400).json({ error: 'controlId requerido' });

    controlEmitter.emit(`control-${controlId}`, { response, remember: remember || false });
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.post('/finish', async (req, res) => {
  if (!authGuard(req, res)) return;
  try {
    const { ocSessionId, directory } = req.body;
    if (!directory) return res.status(400).json({ error: 'directory requerido' });

    if (ocSessionId) {
      try { await opencode.abortSessionInDir(directory, ocSessionId); } catch {}
    }
    opencode.stopServer(directory);

    res.json({ success: true, hash: ocSessionId });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

export default router;
