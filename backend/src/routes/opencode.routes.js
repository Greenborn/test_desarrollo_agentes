import { Router } from 'express';
import { EventEmitter } from 'events';
import fs from 'fs';
import path from 'path';
import os from 'os';
import { fileURLToPath } from 'url';
import zlib from 'zlib';
import db from '../config/db.js';
import opencode from '../services/opencode.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const OPENCODE_DEV_DIR = path.resolve(__dirname, '../../../opencode_dev');
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

function getRepoSkillPaths(repoDir) {
  const configPath = path.join(repoDir, '.opencode', 'opencode.json')
  const defaultPaths = ['.opencode/skills', '.agents/skills']
  try {
    if (fs.existsSync(configPath)) {
      const config = JSON.parse(fs.readFileSync(configPath, 'utf-8'))
      if (Array.isArray(config.skills?.paths) && config.skills.paths.length > 0) {
        return config.skills.paths
      }
    }
  } catch (e) {
    console.log('[opencode] Error reading repo opencode config:', e.message)
  }
  return defaultPaths
}

async function mergeWorkspaceSkillPaths(cwd, workspaceIds) {
  if (!workspaceIds || workspaceIds.length === 0) return

  const projectRoot = path.resolve(__dirname, '../../..')

  const targets = new Set()
  targets.add(cwd)
  targets.add(projectRoot)

  for (const target of targets) {
    const configDir = path.join(target, '.opencode')
    const configPath = path.join(configDir, 'opencode.json')

    let config = { skills: { paths: [] } }
    if (fs.existsSync(configPath)) {
      try {
        config = JSON.parse(fs.readFileSync(configPath, 'utf-8'))
      } catch (e) {
        console.log('[opencode] Error reading opencode config for merge:', e.message)
      }
    }

    if (!config.skills) config.skills = {}
    if (!Array.isArray(config.skills.paths)) config.skills.paths = []

    const existingPaths = new Set(config.skills.paths)
    let changed = false

    for (const wsId of workspaceIds) {
      const ws = await db('workspaces').where({ id: wsId }).select('slug').first()
      if (!ws || !ws.slug) continue

      const repoDir = path.join(OPENCODE_DEV_DIR, ws.slug)
      if (!fs.existsSync(repoDir)) continue

      const paths = getRepoSkillPaths(repoDir)
      for (const relPath of paths) {
        const absPath = path.resolve(repoDir, relPath)
        if (fs.existsSync(absPath)) {
          if (!existingPaths.has(absPath)) {
            config.skills.paths.push(absPath)
            existingPaths.add(absPath)
            changed = true
          }
        }
      }
    }

    // También inyectar los paths de skills del proyecto raíz (ej: .agents/skills)
    // para que estén disponibles para agentes spawneados desde workspaces
    const rootPaths = getRepoSkillPaths(projectRoot)
    for (const relPath of rootPaths) {
      const absPath = path.resolve(projectRoot, relPath)
      if (fs.existsSync(absPath) && !existingPaths.has(absPath)) {
        config.skills.paths.push(absPath)
        existingPaths.add(absPath)
        changed = true
      }
    }

    if (changed) {
      if (!fs.existsSync(configDir)) {
        fs.mkdirSync(configDir, { recursive: true })
      }
      fs.writeFileSync(configPath, JSON.stringify(config, null, 2), 'utf-8')
      console.log(`[opencode] Workspace skill paths merged into ${target}/.opencode/opencode.json`)
    }
  }
}

const MAX_SKILL_CHARS = 4000

async function loadWorkspaceSkillContents(workspaceId) {
  if (!workspaceId) return []
  const result = []

  const ws = await db('workspaces').where({ id: workspaceId }).select('slug').first()
  if (!ws || !ws.slug) return result

  const repoDir = path.join(OPENCODE_DEV_DIR, ws.slug)
  if (!fs.existsSync(repoDir)) return result

  const paths = getRepoSkillPaths(repoDir)
  const scanned = new Set()

  for (const relPath of paths) {
    const dir = path.resolve(repoDir, relPath)
    if (!fs.existsSync(dir)) continue

    const entries = fs.readdirSync(dir, { withFileTypes: true })
    for (const entry of entries) {
      let skillPath = null
      let skillName = null

      if (entry.isDirectory()) {
        skillPath = path.join(dir, entry.name, 'SKILL.md')
        skillName = entry.name
      } else if (entry.isFile() && entry.name.endsWith('.md') && entry.name !== 'SKILL.md') {
        skillPath = path.join(dir, entry.name)
        skillName = entry.name.slice(0, -3)
      }

      if (skillPath && fs.existsSync(skillPath) && !scanned.has(skillName)) {
        scanned.add(skillName)
        let content = fs.readFileSync(skillPath, 'utf-8')
        if (content.length > MAX_SKILL_CHARS) {
          content = content.slice(0, MAX_SKILL_CHARS) + '\n\n[...truncado...]'
        }
        result.push(`[SKILL DE AMBIENTE: ${skillName}]\n${content}\n[/SKILL]`)
      }
    }
  }

  return result
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
    await mergeWorkspaceSkillPaths(cwd, req.session.workspaceIds);
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
    await mergeWorkspaceSkillPaths(cwd, req.session.workspaceIds);
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

    // Inject workspace skill contents as instructions for the session's workspace
    let sessionWsId = null
    if (sessionId) {
      const sess = await db('chat_sessions').where({ id: sessionId }).select('workspace_id').first()
      if (sess && sess.workspace_id) sessionWsId = sess.workspace_id
    }
    const wsSkillParts = await loadWorkspaceSkillContents(sessionWsId)
    for (const sp of wsSkillParts) {
      parts.push({ type: 'text', text: sp })
    }

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

    await mergeWorkspaceSkillPaths(cwd, req.session.workspaceIds);
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

    await mergeWorkspaceSkillPaths(cwd, req.session.workspaceIds);
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

    // Inject workspace skills for editor (use first session workspaceId as fallback)
    const editorWsId = req.session?.workspaceIds?.[0] || null
    const editorSkillParts = await loadWorkspaceSkillContents(editorWsId)
    for (const sp of editorSkillParts) {
      parts.push({ type: 'text', text: sp })
    }

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

router.post('/sync-skills-project', async (req, res) => {
  if (!authGuard(req, res)) return

  const workspaceIds = req.session.workspaceIds
  if (!workspaceIds || workspaceIds.length === 0) {
    return res.status(400).json({ error: 'No hay espacios de trabajo seleccionados en la sesión.' })
  }

  try {
    const projectRoot = path.resolve(__dirname, '../../..')
    const configDir = path.join(projectRoot, '.opencode')
    const configPath = path.join(configDir, 'opencode.json')

    let config = { $schema: 'https://opencode.ai/config.json', skills: { paths: [] } }
    if (fs.existsSync(configPath)) {
      try {
        config = JSON.parse(fs.readFileSync(configPath, 'utf-8'))
      } catch (parseErr) {
        console.log('[opencode] Error parseando config del proyecto, se sobrescribirá:', parseErr.message)
      }
    }
    if (!config.skills) config.skills = {}
    if (!Array.isArray(config.skills.paths)) config.skills.paths = []

    const existingPaths = new Set(config.skills.paths)
    let changed = false

    for (const wsId of workspaceIds) {
      const ws = await db('workspaces').where({ id: wsId }).select('slug').first()
      if (!ws || !ws.slug) continue

      const repoDir = path.join(OPENCODE_DEV_DIR, ws.slug)
      if (!fs.existsSync(repoDir)) {
        console.log(`[opencode] Workspace ${ws.slug}: repo dir no encontrado en ${repoDir}`)
        continue
      }

      const skillPaths = getRepoSkillPaths(repoDir)
      for (const relPath of skillPaths) {
        const absPath = path.resolve(repoDir, relPath)
        if (fs.existsSync(absPath) && !existingPaths.has(absPath)) {
          config.skills.paths.push(absPath)
          existingPaths.add(absPath)
          changed = true
        }
      }
    }

    // También registrar paths de skills del proyecto raíz
    const rootPaths = getRepoSkillPaths(projectRoot)
    for (const relPath of rootPaths) {
      const absPath = path.resolve(projectRoot, relPath)
      if (fs.existsSync(absPath) && !existingPaths.has(absPath)) {
        config.skills.paths.push(absPath)
        existingPaths.add(absPath)
        changed = true
      }
    }

    if (!changed) {
      return res.json({
        success: true,
        message: 'Todos los paths de skills de los espacios de trabajo ya estaban sincronizados en la configuración del proyecto.',
        config,
      })
    }

    if (!fs.existsSync(configDir)) {
      fs.mkdirSync(configDir, { recursive: true })
    }
    config.$schema = 'https://opencode.ai/config.json'
    fs.writeFileSync(configPath, JSON.stringify(config, null, 2), 'utf-8')

    console.log(`[opencode] Skills del proyecto sincronizados en ${configPath}`)
    res.json({
      success: true,
      message: `Skills de los espacios de trabajo sincronizados en la configuración de OpenCode del proyecto.`,
      config,
    })
  } catch (err) {
    console.log('Error en opencode/sync-skills-project:', err.message)
    res.status(500).json({ error: err.message })
  }
})

router.post('/register-skills-global', async (req, res) => {
  if (!authGuard(req, res)) return;

  const { slug } = req.body;

  try {
    const globalConfigDir = path.join(os.homedir(), '.config', 'opencode');
    const globalConfigPath = path.join(globalConfigDir, 'opencode.json');

    let config = {};
    if (fs.existsSync(globalConfigPath)) {
      try {
        config = JSON.parse(fs.readFileSync(globalConfigPath, 'utf-8'));
      } catch (parseErr) {
        console.log('[opencode] Error parseando config global, se sobrescribirá:', parseErr.message);
      }
    }
    if (!config.skills) config.skills = {};
    if (!Array.isArray(config.skills.paths)) config.skills.paths = [];

    const existingPaths = new Set(config.skills.paths);
    const projectRoot = path.resolve(__dirname, '../../..');
    let changed = false;

    let workspaces;
    if (slug) {
      const ws = await db('workspaces').where({ slug }).first();
      if (!ws) {
        return res.status(404).json({ error: `Workspace con slug "${slug}" no encontrado` });
      }
      workspaces = [ws];
    } else {
      workspaces = await db('workspaces').select('*');
    }

    for (const ws of workspaces) {
      const repoDir = path.join(OPENCODE_DEV_DIR, ws.slug);
      if (!fs.existsSync(repoDir)) {
        console.log(`[opencode] Workspace ${ws.slug}: repo dir no encontrado en ${repoDir}`);
        continue;
      }

      const skillPaths = getRepoSkillPaths(repoDir);
      for (const relPath of skillPaths) {
        const absPath = path.resolve(repoDir, relPath);
        if (fs.existsSync(absPath) && !existingPaths.has(absPath)) {
          config.skills.paths.push(absPath);
          existingPaths.add(absPath);
          changed = true;
        }
      }
    }

    // También registrar paths de skills del proyecto raíz
    const rootPaths = getRepoSkillPaths(projectRoot);
    for (const relPath of rootPaths) {
      const absPath = path.resolve(projectRoot, relPath);
      if (fs.existsSync(absPath) && !existingPaths.has(absPath)) {
        config.skills.paths.push(absPath);
        existingPaths.add(absPath);
        changed = true;
      }
    }

    // Siempre incluir .agents/skills explícitamente
    const agentsSkillsPath = path.resolve(projectRoot, '.agents', 'skills');
    if (fs.existsSync(agentsSkillsPath) && !existingPaths.has(agentsSkillsPath)) {
      config.skills.paths.push(agentsSkillsPath);
      existingPaths.add(agentsSkillsPath);
      changed = true;
    }

    if (!changed) {
      return res.json({
        success: true,
        message: 'Todos los paths de skills ya estaban registrados en la configuración global.',
        config,
      });
    }

    if (!fs.existsSync(globalConfigDir)) {
      fs.mkdirSync(globalConfigDir, { recursive: true });
    }
    config.$schema = 'https://opencode.ai/config.json';
    fs.writeFileSync(globalConfigPath, JSON.stringify(config, null, 2), 'utf-8');

    console.log(`[opencode] Skills globales actualizados en ${globalConfigPath}`);
    res.json({
      success: true,
      message: `Skills registrados en la configuración global de OpenCode.`,
      config,
    });
  } catch (err) {
    console.log('Error en opencode/register-skills-global:', err.message);
    res.status(500).json({ error: err.message });
  }
});

export default router;
