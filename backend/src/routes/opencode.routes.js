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
  const { prompt, provider, model, thinking, mode, sessionId } = req.body;
  if (!prompt) return res.status(400).json({ error: 'prompt requerido' });

  try {
    const ocSession = await opencode.createSession('Agent Orchestrator - ' + (prompt.slice(0, 50)));
    const ocSessionId = ocSession.id;

    if (sessionId) {
      await db('chat_messages').insert({
        session_id: sessionId, role: 'opencode_info',
        content: JSON.stringify({ type: 'session_created', ocSessionId }),
      });
    }

    res.writeHead(200, {
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache',
      'Connection': 'keep-alive',
    });

    let fullResponse = '';

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

    const parts = [{ type: 'text', text: prompt }];

    if (mode === 'Plan') {
      parts.unshift({ type: 'text', text: 'First, create a detailed plan. Do not make any changes yet.' });
    }

    const msgOptions = {};
    if (Object.keys(modelConfig).length > 0) {
      msgOptions.model = modelConfig;
    }

    try {
      let fullResponse = '';
      const partTypes = {};

      for await (const event of opencode.streamSession(ocSessionId, parts, msgOptions)) {
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
            await opencode.respondToPermission(ocSessionId, event.properties.permissionID, response.response, response.remember || false);
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

      const diff = await opencode.getSessionDiff(ocSessionId);

      const summary = {
        sessionId: ocSessionId,
        hash: ocSessionId,
        diff: diff || [],
      };

      if (sessionId) {
        await db('chat_messages').insert({
          session_id: sessionId,
          role: 'opencode_result',
          content: JSON.stringify(summary),
        });
        await db('chat_messages').insert({
          session_id: sessionId,
          role: 'opencode_info',
          content: JSON.stringify({ type: 'finished', ocSessionId }),
        });
      }

      res.write(`data: ${JSON.stringify({ type: 'done', ...summary })}\n\n`);
      res.end();

    } catch (msgErr) {
      console.log('Error en opencode streamSession:', msgErr.message);
      res.write(`data: ${JSON.stringify({ type: 'error', content: msgErr.message })}\n\n`);

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
    const { ocSessionId } = req.body;
    if (!ocSessionId) return res.status(400).json({ error: 'ocSessionId requerido' });

    await opencode.abortSession(ocSessionId);

    let diff = [];
    try {
      diff = await opencode.getSessionDiff(ocSessionId);
    } catch {}

    res.json({ success: true, hash: ocSessionId, diff });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

export default router;
