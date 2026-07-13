import { Router } from 'express';
import { EventEmitter } from 'events';
import zlib from 'zlib';
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
  } catch (dbErr) {
    console.log('Error al obtener user_setting:', dbErr.message);
    return null;
  }
}

async function saveUserSetting(userId, key, value) {
  await db('user_settings')
    .insert({ user_id: userId, key, value })
    .onConflict(['user_id', 'key'])
    .merge();
}

const MAX_MSG_LENGTH = 50000;

async function saveLongMessage(sessionId, role, content, extraFields = {}) {
  if (!content) {
    await db('chat_messages').insert({ session_id: sessionId, role, content: '(sin respuesta)', ...extraFields });
    return;
  }

  const parts = [];
  for (let i = 0; i < content.length; i += MAX_MSG_LENGTH) {
    parts.push(content.slice(i, i + MAX_MSG_LENGTH));
  }

  const inserts = parts.map((part, i) => ({
    session_id: sessionId,
    role,
    content: parts.length > 1
      ? `[Parte ${i + 1}/${parts.length}]\n${part}`
      : part,
    ...(i === 0 ? extraFields : {}),
  }));

  await db('chat_messages').insert(inserts);
}

router.get('/start', async (req, res) => {
  if (!authGuard(req, res)) return;
  try {
    const { sessionId } = req.query;
    let cwd = process.cwd();
    if (sessionId) {
      const chatSession = await db('chat_sessions').where({ id: sessionId }).select('cwd').first();
      if (chatSession && chatSession.cwd) cwd = chatSession.cwd;
    }
    const wsIds = req.session.workspaceIds || [1];
    const wsId = wsIds[0] || 1;
    const localeRow = await db('settings').where({ workspace_id: wsId, setting_key: 'locale' }).first();
    const locale = localeRow ? localeRow.setting_value : 'es_ES.UTF-8';
    const providerData = await opencode.getModels(cwd, sessionId || null, locale);
    let savedProvider = await getUserSetting(req.session.userId, 'opencode_last_provider');
    let savedModel = await getUserSetting(req.session.userId, 'opencode_last_model');
    let savedThinking = await getUserSetting(req.session.userId, 'opencode_last_thinking');
    let savedMode = await getUserSetting(req.session.userId, 'opencode_last_mode');
    let savedTemperature = await getUserSetting(req.session.userId, 'opencode_last_temperature');

    if (sessionId) {
      const chatSession = await db('chat_sessions').where({ id: sessionId }).select('proyecto_id').first();
      if (chatSession && chatSession.proyecto_id) {
        const projectVars = await db('project_variables')
          .where({ proyecto_id: chatSession.proyecto_id })
          .whereIn('key', ['opencode_provider', 'opencode_model', 'opencode_thinking', 'opencode_mode', 'opencode_temperature'])
          .select('key', 'value');
        const varMap = {};
        for (const v of projectVars) varMap[v.key] = v.value;
        if (varMap['opencode_provider']) savedProvider = varMap['opencode_provider'];
        if (varMap['opencode_model']) savedModel = varMap['opencode_model'];
        if (varMap['opencode_thinking']) savedThinking = varMap['opencode_thinking'];
        if (varMap['opencode_mode']) savedMode = varMap['opencode_mode'];
        if (varMap['opencode_temperature']) savedTemperature = varMap['opencode_temperature'];
      }
    }

    res.json({
      providers: providerData.providers || [],
      defaultModels: providerData.default || {},
      savedProvider,
      savedModel,
      savedThinking,
      savedMode,
      savedTemperature,
    });
  } catch (err) {
    console.log('Error en opencode/start:', err.message);
    res.status(500).json({ error: err.message });
  }
});

router.post('/select', async (req, res) => {
  if (!authGuard(req, res)) return;
  try {
    const { key, value, sessionId } = req.body;
    if (!key || value === undefined) {
      return res.status(400).json({ error: 'key y value requeridos' });
    }
    await saveUserSetting(req.session.userId, `opencode_last_${key}`, value);

    if (sessionId) {
      const chatSession = await db('chat_sessions').where({ id: sessionId }).select('proyecto_id').first();
      if (chatSession && chatSession.proyecto_id) {
        await db('project_variables')
          .insert({ proyecto_id: chatSession.proyecto_id, key: `opencode_${key}`, value: String(value), type: 'db' })
          .onConflict(['proyecto_id', 'key'])
          .merge();
      }
    }

    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.post('/send', async (req, res) => {
  if (!authGuard(req, res)) return;
  const { prompt, provider, model, thinking, mode, sessionId, temperature, ocSessionId: existingOcSessionId } = req.body;
  if (!prompt) return res.status(400).json({ error: 'prompt requerido' });

  try {
    let cwd = process.cwd();
    if (sessionId) {
      const chatSession = await db('chat_sessions').where({ id: sessionId }).select('cwd').first();
      if (chatSession && chatSession.cwd) cwd = chatSession.cwd;
    }

    const wsIds = req.session.workspaceIds || [1];
    const wsId = wsIds[0] || 1;
    const localeRow = await db('settings').where({ workspace_id: wsId, setting_key: 'locale' }).first();
    const locale = localeRow ? localeRow.setting_value : 'es_ES.UTF-8';
    const server = await opencode.getOrStartServer(cwd, sessionId, locale);

    const agentName = mode === 'Plan' ? 'plan' : 'build';
    let ocSessionId = existingOcSessionId;
    if (!ocSessionId) {
      const ocSession = await server.createSession('Agent Orchestrator - ' + (prompt.slice(0, 50)), agentName);
      ocSessionId = ocSession.id;
    }

    if (sessionId) {
      await db('chat_messages').insert({
        session_id: sessionId, role: 'user', content: prompt,
      });
      await db('chat_sessions').where({ id: sessionId }).update({ updated_at: db.fn.now() });
    }

    res.writeHead(200, {
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache',
      'Connection': 'keep-alive',
    });

    const keepAlive = setInterval(() => {
      try { res.write(':ping\n\n'); } catch (err) { console.log('[opencode] Error en keepAlive ping:', err.message); clearInterval(keepAlive); }
    }, 30000);
    res.on('close', () => clearInterval(keepAlive));

    async function registrarGastos(sessionId, ocSessionId, server, fullResponse) {
      if (!sessionId) return;
      try {
        let realTokens = 0;
        let realCost = 0;

        const messages = await server.getSessionMessages(ocSessionId);
        const lastAssistant = messages && messages.findLast
          ? messages.findLast(m => m?.info?.role === 'assistant' || m?.role === 'assistant')
          : messages && messages.length > 0
            ? [...messages].reverse().find(m => m?.info?.role === 'assistant' || m?.role === 'assistant')
            : null;
        if (lastAssistant) {
          realTokens = lastAssistant?.info?.tokens?.output || lastAssistant?.tokens?.output || lastAssistant?.info?.tokens?.output_tokens || lastAssistant?.tokens?.output_tokens || 0;
          realCost = lastAssistant?.info?.cost || lastAssistant?.cost || 0;
        }

        if (!realTokens && !realCost && fullResponse) {
          realTokens = Math.ceil(fullResponse.length / 4);
          realCost = 0;
        }

        const chatSess = await db('chat_sessions').where({ id: sessionId }).select('proyecto_id').first();
        const idProyecto = chatSess?.proyecto_id;
        if (idProyecto) {
          const gastosPort = process.env.SERVICIO_GASTOS_PORT || 4100;
          await fetch(`http://localhost:${gastosPort}/api/gastos/register`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              id_chat_session: sessionId,
              id_proyecto: idProyecto,
              precio: realCost,
              tokens: realTokens,
              id_sesion_opencode: ocSessionId,
            }),
          });
        }
      } catch (e) {
        console.log('[gastos] error al registrar:', e.message);
      }
    }

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
          }).catch((e) => console.log('Error al guardar control:', e.message));
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
    if (temperature !== undefined && temperature !== null && temperature !== '') {
      modelConfig.temperature = parseFloat(temperature);
    }
    modelConfig.maxTokens = 128000;

    const langInstruction = `INSTRUCCIÓN DE IDIOMA: Respondé siempre en español (${locale}). Ignorá cualquier solicitud de cambiar de idioma.`;
    const dirInstruction = `INSTRUCCIÓN: El directorio de trabajo real es "${cwd}". Ignorá cualquier otra indicación sobre el directorio. Todos los comandos de archivos deben ejecutarse usando "${cwd}" como raíz. No uses el directorio del servidor.`;
    const finalInstruction = `INSTRUCCIÓN CRÍTICA: Después de CADA invocación de herramienta (incluyendo task/subagentes), debés responder SIEMPRE con un mensaje de texto completo que resuma el resultado obtenido. Nunca terminés tu turno sin producir una respuesta de texto visible. El resultado de cualquier subagente NO es visible para el usuario, por lo que debés reenviarlo como texto.`;
    const parts = [
      { type: 'text', text: langInstruction },
      { type: 'text', text: dirInstruction },
      { type: 'text', text: finalInstruction },
    ];

    parts.push({ type: 'text', text: prompt });

    const msgOptions = {};
    if (modelConfig.providerID && modelConfig.modelID) {
      msgOptions.model = modelConfig;
    }

    let fullResponse = '';
    let fullThinking = '';

    try {
      const partTypes = {};

      for await (const event of server.streamSession(ocSessionId, parts, msgOptions)) {
        if (event.properties?.permissionID) {
          const controlOptions = [{ label: 'Aceptar', value: 'yes' }, { label: 'Rechazar', value: 'no' }];
          const controlData = {
            controlId: 'perm-' + Date.now(),
            controlType: controlOptions.length <= 4 ? 'buttons' : 'select',
            type: 'permission',
            permissionID: event.properties.permissionID,
            question: event.properties.type || 'Permiso requerido',
            options: controlOptions,
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

        if (event.type === 'message.part.delta' && event.properties?.delta) {
          const partId = event.properties.partID;
          const partType = partTypes[partId] || '';
          const delta = event.properties.delta || '';
          const field = event.properties.field || '';
          let terminalLine = '';

          if (partType === 'reasoning') {
            fullThinking += delta;
            res.write(`data: ${JSON.stringify({ type: 'thinking', content: delta, sessionId })}\n\n`);
          } else if (partType === 'tool_call') {
            let toolName = delta;
            try { const p = JSON.parse(delta); if (p.name) toolName = p.name; if (p.arguments) toolName += ' ' + JSON.stringify(p.arguments); } catch (err) { console.log('[opencode] Error al parsear tool call delta:', err.message); }
            terminalLine = `\x1b[38;5;214m$ ${toolName}\x1b[0m`;
            res.write(`data: ${JSON.stringify({ type: 'tool_call', content: delta, field, sessionId })}\n\n`);
          } else if (partType === 'tool_result') {
            terminalLine = `\x1b[38;5;246m${delta}\x1b[0m`;
            res.write(`data: ${JSON.stringify({ type: 'tool_result', content: delta, field, sessionId })}\n\n`);
          } else if (field === 'text') {
            fullResponse += delta;
            terminalLine = delta;
            res.write(`data: ${JSON.stringify({ type: 'response', content: delta, sessionId })}\n\n`);
          } else {
            res.write(`data: ${JSON.stringify({ type: 'tool_data', content: delta, partType, field, sessionId })}\n\n`);
          }
          if (terminalLine) {
            res.write(`data: ${JSON.stringify({ type: 'terminal', line: terminalLine, partType, sessionId })}\n\n`);
          }
        }

        if (event.type === 'session.status' && event.properties?.status?.type === 'idle') {
          break;
        }
      }

      const diff = await server.getSessionDiff(ocSessionId);

      res.write(`data: ${JSON.stringify({ type: 'terminal', line: '', partType: 'separator', sessionId })}\n\n`);
      if (diff && diff.length > 0) {
        for (const d of diff) {
          res.write(`data: ${JSON.stringify({ type: 'terminal', line: `\x1b[38;5;39m📁 ${d.path} (\x1b[38;5;214m${d.type || 'modificado'}\x1b[38;5;39m)\x1b[0m`, partType: 'diff', sessionId })}\n\n`);
        }
      }
      res.write(`data: ${JSON.stringify({ type: 'terminal', line: '\x1b[38;5;40m✅ Hecho.\x1b[0m', partType: 'done', sessionId })}\n\n`);

      if (!fullResponse || fullResponse.trim().length === 0) {
        try {
          const messages = await server.getSessionMessages(ocSessionId);
          const lastAssistant = messages
            ? [...messages].reverse().find(m => m?.role === 'assistant' || m?.info?.role === 'assistant')
            : null;
          if (lastAssistant?.content) {
            const fallbackText = typeof lastAssistant.content === 'string'
              ? lastAssistant.content
              : JSON.stringify(lastAssistant.content);
            if (fallbackText.trim()) {
              fullResponse = fallbackText;
              console.log(`[opencode] fallback recuperó respuesta final de getSessionMessages (${fallbackText.length} chars)`);
            }
          }
        } catch (msgErr) {
          console.log('[opencode] fallback getSessionMessages falló:', msgErr.message);
        }
      }

      if (sessionId) {
        await saveLongMessage(sessionId, 'opencode_result', fullResponse, { thinking: fullThinking || null });
        await saveLongMessage(sessionId, 'opencode_info', JSON.stringify({ type: 'finished', hash: ocSessionId, diff: diff || [] }));
        await db('chat_sessions').where({ id: sessionId }).update({ updated_at: db.fn.now() });
      }

      await registrarGastos(sessionId, ocSessionId, server, fullResponse);

      res.write(`data: ${JSON.stringify({ type: 'done', ocSessionId, hash: ocSessionId, fullResponse, thinking: fullThinking, diff: diff || [] })}\n\n`);
      res.end();

    } catch (msgErr) {
      console.log('Error en opencode streamSession:', msgErr.message);
      try {
        res.write(`data: ${JSON.stringify({ type: 'error', content: msgErr.message })}\n\n`);
      } catch (writeErr) {
        console.log('Error al escribir error en stream SSE:', writeErr.message);
      }
      if (sessionId) {
        try {
          await saveLongMessage(sessionId, 'opencode_result', JSON.stringify({ error: msgErr.message }));
          await saveLongMessage(sessionId, 'opencode_info', JSON.stringify({ type: 'error', error: msgErr.message }));
        } catch (e) {
          console.log('Error al guardar mensajes de error:', e.message);
        }
      }
      await registrarGastos(sessionId, ocSessionId, server, fullResponse).catch((e) => console.log('[gastos] error en catch post-error:', e.message));
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
      } catch (writeErr) {
        console.log('Error al escribir error en respuesta SSE:', writeErr.message);
      }
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

router.post('/abort', async (req, res) => {
  if (!authGuard(req, res)) return;
  try {
    const { ocSessionId, sessionId } = req.body;
    if (!ocSessionId && !sessionId) return res.status(400).json({ error: 'ocSessionId o sessionId requerido' });

    if (ocSessionId) {
      if (sessionId) {
        await opencode.abortSessionInDir(sessionId, ocSessionId);
      } else {
        await opencode.abortSession(ocSessionId);
      }
    }
    res.json({ success: true });
  } catch (err) {
    console.log('Error en opencode/abort:', err.message);
    res.status(500).json({ error: err.message });
  }
});

router.post('/finish', async (req, res) => {
  if (!authGuard(req, res)) return;
  try {
    const { ocSessionId, sessionId } = req.body;
    if (!sessionId) return res.status(400).json({ error: 'sessionId requerido' });

    if (ocSessionId) {
      try { await opencode.abortSessionInDir(sessionId, ocSessionId); } catch (abortErr) {
        console.log('Error al abortar sesión OpenCode en /finish:', abortErr.message);
      }
    }
    opencode.stopServer(sessionId);

    res.json({ success: true, hash: ocSessionId });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.post('/editor-start', async (req, res) => {
  if (!authGuard(req, res)) return;
  try {
    const { cwd } = req.body;
    if (!cwd) return res.status(400).json({ error: 'cwd requerido' });

    const wsIds = req.session.workspaceIds || [1];
    const wsId = wsIds[0] || 1;
    const localeRow = await db('settings').where({ workspace_id: wsId, setting_key: 'locale' }).first();
    const locale = localeRow ? localeRow.setting_value : 'es_ES.UTF-8';

    const serverKey = `editor_${cwd}`;
    const providerData = await opencode.getModels(cwd, null, locale, serverKey);

    res.json({
      providers: providerData.providers || [],
      defaultModels: providerData.default || {},
    });
  } catch (err) {
    console.log('Error en opencode/editor-start:', err.message);
    res.status(500).json({ error: err.message });
  }
});

router.post('/editor-send', async (req, res) => {
  if (!authGuard(req, res)) return;
  const { prompt, provider, model, thinking, mode, temperature, cwd } = req.body;
  if (!prompt) return res.status(400).json({ error: 'prompt requerido' });
  if (!cwd) return res.status(400).json({ error: 'cwd requerido' });

  try {
    const wsIds = req.session.workspaceIds || [1];
    const wsId = wsIds[0] || 1;
    const localeRow = await db('settings').where({ workspace_id: wsId, setting_key: 'locale' }).first();
    const locale = localeRow ? localeRow.setting_value : 'es_ES.UTF-8';

    const serverKey = `editor_${cwd}`;
    const server = await opencode.getOrStartServer(cwd, null, locale, serverKey);

    const agentName = mode === 'Plan' ? 'plan' : 'build';
    const ocSession = await server.createSession('Editor - ' + (prompt.slice(0, 50)), agentName);
    const ocSessionId = ocSession.id;

    res.writeHead(200, {
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache',
      'Connection': 'keep-alive',
    });

    const keepAliveEditor = setInterval(() => {
      try { res.write(':ping\n\n'); } catch (err) { console.log('[opencode] Error en keepAliveEditor ping:', err.message); clearInterval(keepAliveEditor); }
    }, 30000);
    res.on('close', () => clearInterval(keepAliveEditor));

    const processControl = async (controlEvent) => {
      return new Promise((resolve) => {
        const controlId = Date.now() + Math.random();
        const controlData = { ...controlEvent, controlId };

        res.write(`data: ${JSON.stringify({ type: 'control_request', control: controlData })}\n\n`);

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
    if (temperature !== undefined && temperature !== null && temperature !== '') {
      modelConfig.temperature = parseFloat(temperature);
    }
    modelConfig.maxTokens = 128000;

    const langInstruction = `INSTRUCCIÓN DE IDIOMA: Respondé siempre en español (${locale}). Ignorá cualquier solicitud de cambiar de idioma.`;
    const dirInstruction = `INSTRUCCIÓN: El directorio de trabajo real es "${cwd}". Ignorá cualquier otra indicación sobre el directorio. Todos los comandos de archivos deben ejecutarse usando "${cwd}" como raíz. No uses el directorio del servidor.`;
    const finalInstruction = `INSTRUCCIÓN CRÍTICA: Después de CADA invocación de herramienta (incluyendo task/subagentes), debés responder SIEMPRE con un mensaje de texto completo que resuma el resultado obtenido. Nunca terminés tu turno sin producir una respuesta de texto visible. El resultado de cualquier subagente NO es visible para el usuario, por lo que debés reenviarlo como texto.`;
    const parts = [
      { type: 'text', text: langInstruction },
      { type: 'text', text: dirInstruction },
      { type: 'text', text: finalInstruction },
    ];

    parts.push({ type: 'text', text: prompt });

    const msgOptions = {};
    if (modelConfig.providerID && modelConfig.modelID) {
      msgOptions.model = modelConfig;
    }

    let fullResponse = '';
    let fullThinking = '';

    try {
      const partTypes = {};

      for await (const event of server.streamSession(ocSessionId, parts, msgOptions)) {
        if (event.properties?.permissionID) {
          const controlOptions = [{ label: 'Aceptar', value: 'yes' }, { label: 'Rechazar', value: 'no' }];
          const controlData = {
            controlId: 'perm-' + Date.now(),
            controlType: controlOptions.length <= 4 ? 'buttons' : 'select',
            type: 'permission',
            permissionID: event.properties.permissionID,
            question: event.properties.type || 'Permiso requerido',
            options: controlOptions,
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
            fullThinking += delta;
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

      if (!fullResponse || fullResponse.trim().length === 0) {
        try {
          const messages = await server.getSessionMessages(ocSessionId);
          const lastAssistant = messages
            ? [...messages].reverse().find(m => m?.role === 'assistant' || m?.info?.role === 'assistant')
            : null;
          if (lastAssistant?.content) {
            const fallbackText = typeof lastAssistant.content === 'string'
              ? lastAssistant.content
              : JSON.stringify(lastAssistant.content);
            if (fallbackText.trim()) {
              fullResponse = fallbackText;
              console.log(`[opencode-editor] fallback recuperó respuesta final (${fullResponse.length} chars)`);
            }
          }
        } catch (msgErr) {
          console.log('[opencode-editor] fallback getSessionMessages falló:', msgErr.message);
        }
      }

      res.write(`data: ${JSON.stringify({ type: 'done', ocSessionId, hash: ocSessionId, fullResponse, thinking: fullThinking })}\n\n`);
      res.end();

    } catch (msgErr) {
      console.log('Error en opencode server streamSession:', msgErr.message);
      try {
        res.write(`data: ${JSON.stringify({ type: 'error', content: msgErr.message })}\n\n`);
      } catch (writeErr) {
        console.log('Error al escribir error en stream SSE:', writeErr.message);
      }
      res.end();
    }

  } catch (err) {
    console.log('Error en opencode/editor-send:', err.message);
    if (!res.headersSent) {
      res.status(500).json({ error: err.message });
    } else {
      try {
        res.write(`data: ${JSON.stringify({ type: 'error', content: err.message })}\n\n`);
        res.end();
      } catch (writeErr) {
        console.log('Error al escribir error en respuesta SSE:', writeErr.message);
      }
    }
  }
});

router.post('/editor-abort', async (req, res) => {
  if (!authGuard(req, res)) return;
  try {
    const { ocSessionId, cwd } = req.body;
    if (!ocSessionId && !cwd) return res.status(400).json({ error: 'ocSessionId o cwd requerido' });

    if (ocSessionId) {
      if (cwd) {
        const serverKey = `editor_${cwd}`;
        await opencode.abortSessionInDir(serverKey, ocSessionId);
      } else {
        await opencode.abortSession(ocSessionId);
      }
    }
    res.json({ success: true });
  } catch (err) {
    console.log('Error en opencode/editor-abort:', err.message);
    res.status(500).json({ error: err.message });
  }
});

router.post('/editor-finish', async (req, res) => {
  if (!authGuard(req, res)) return;
  try {
    const { cwd } = req.body;
    if (!cwd) return res.status(400).json({ error: 'cwd requerido' });

    opencode.stopEditorServer(cwd);
    res.json({ success: true });
  } catch (err) {
    console.log('Error en opencode/editor-finish:', err.message);
    res.status(500).json({ error: err.message });
  }
});

function crc32(buf) {
  let c = 0xffffffff;
  const table = new Int32Array(256);
  for (let n = 0; n < 256; n++) {
    let v = n;
    for (let k = 0; k < 8; k++) v = (v & 1) ? (0xedb88320 ^ (v >>> 1)) : (v >>> 1);
    table[n] = v;
  }
  for (let i = 0; i < buf.length; i++) c = table[(c ^ buf[i]) & 0xff] ^ (c >>> 8);
  return (c ^ 0xffffffff) >>> 0;
}

function pngChunk(type, data) {
  const len = Buffer.alloc(4);
  len.writeUInt32BE(data.length);
  const t = Buffer.from(type, 'ascii');
  const crcData = Buffer.concat([t, data]);
  const c = Buffer.alloc(4);
  c.writeUInt32BE(crc32(crcData));
  return Buffer.concat([len, t, data, c]);
}

function generateTestPNG(width, height) {
  const sig = Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]);
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(width, 0);
  ihdr.writeUInt32BE(height, 4);
  ihdr[8] = 8; ihdr[9] = 2; ihdr[10] = 0; ihdr[11] = 0; ihdr[12] = 0;

  const raw = [];
  for (let y = 0; y < height; y++) {
    raw.push(0);
    for (let x = 0; x < width; x++) {
      raw.push(Math.floor(255 * x / width), Math.floor(255 * y / height), 128);
    }
  }
  const compressed = zlib.deflateSync(Buffer.from(raw));

  return Buffer.concat([sig, pngChunk('IHDR', ihdr), pngChunk('IDAT', compressed), pngChunk('IEND', Buffer.alloc(0))]);
}

function makeIIP(pngBuffer) {
  const b64 = pngBuffer.toString('base64');
  return `\x1b]1337;File=inline=1;size=${pngBuffer.length}:${b64}\x07`;
}

router.get('/test-image', async (req, res) => {
  try {
    const png = generateTestPNG(200, 100);
    const iip = makeIIP(png);

    res.writeHead(200, {
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache',
      'Connection': 'keep-alive',
    });

    const lines = [
      `\x1b[38;5;39m📸 Test de imagen inline (200x100)\x1b[0m`,
      iip,
      `\x1b[38;5;245m✅ Imagen enviada — Sixel/IIP habilitado\x1b[0m`,
    ];

    for (const line of lines) {
      res.write(`data: ${JSON.stringify({ type: 'terminal', line, partType: 'test' })}\n\n`);
    }

    res.write(`data: ${JSON.stringify({ type: 'done', ocSessionId: null, fullResponse: '', diff: [] })}\n\n`);
    res.end();
  } catch (err) {
    console.log('Error en opencode/test-image:', err.message);
    if (!res.headersSent) res.status(500).json({ error: err.message });
    else res.end();
  }
});

export default router;
