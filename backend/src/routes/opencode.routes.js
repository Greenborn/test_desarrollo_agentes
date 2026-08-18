import { Router } from 'express';
import fs from 'fs';
import path from 'path';
import os from 'os';
import { fileURLToPath } from 'url';
import zlib from 'zlib';
import db from '../config/db.js';
import dbConfig from '../config/dbConfig.js';
import dbUserSettings from '../config/dbUserSettings.js';
import dbProjectVariables from '../config/dbProjectVariables.js';
import opencode from '../services/opencode.js';
import {
  controlEmitter,
  getRepoSkillPaths,
  ensureGitignore,
  mergeWorkspaceSkillPaths,
  loadWorkspaceSkillContents,
  runOpencodePrompt,
} from '../services/opencodeStream.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const OPENCODE_DEV_DIR = path.resolve(__dirname, '../../../opencode_dev');
const router = Router();

function authGuard(req, res) {
  if (!req.session?.userId) {
    res.status(401).json({ error: 'Sesión no válida' });
    return false;
  }
  return true;
}

async function getUserSetting(userId, key) {
  try {
    const row = await dbUserSettings('user_settings').where({ user_id: userId, key }).first();
    return row ? row.value : null;
  } catch (dbErr) {
    console.log('Error al obtener user_setting:', dbErr.message);
    return null;
  }
}

async function saveUserSetting(userId, key, value) {
  await dbUserSettings('user_settings')
    .insert({ user_id: userId, key, value })
    .onConflict(['user_id', 'key'])
    .merge();
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
    const localeRow = await dbConfig('settings').where({ workspace_id: wsId, setting_key: 'locale' }).first();
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
        const projectVars = await dbProjectVariables('project_variables')
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
        await dbProjectVariables('project_variables')
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
  const { prompt, provider, model, thinking, mode, sessionId, temperature } = req.body;
  if (!prompt) return res.status(400).json({ error: 'prompt requerido' });

  const wsIds = req.session.workspaceIds || [1];
  let sseStarted = false;
  let keepAlive = null;
  const startSSE = () => {
    if (sseStarted) return;
    sseStarted = true;
    res.writeHead(200, {
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache',
      'Connection': 'keep-alive',
    });
    keepAlive = setInterval(() => {
      try { res.write(':ping\n\n'); } catch (err) { console.log('[opencode] Error en keepAlive ping:', err.message); clearInterval(keepAlive); }
    }, 30000);
    res.on('close', () => clearInterval(keepAlive));
  };

  try {
    const writeEvent = (event) => {
      startSSE();
      try { res.write(`data: ${JSON.stringify(event)}\n\n`); }
      catch (err) { console.log('[opencode] Error al escribir SSE:', err.message); }
    };
    const map = {
      control: (e) => writeEvent({ type: 'control_request', control: e.control, agentId: e.agentId }),
      terminal: (e) => writeEvent({ type: 'terminal', line: e.line, partType: e.partType, sessionId, agentId: e.agentId }),
      thinking: (e) => writeEvent({ type: 'thinking', content: e.content, sessionId, agentId: e.agentId }),
      tool_call: (e) => writeEvent({ type: 'tool_call', content: e.content, field: e.field, sessionId, agentId: e.agentId }),
      tool_result: (e) => writeEvent({ type: 'tool_result', content: e.content, field: e.field, sessionId, agentId: e.agentId }),
      response: (e) => writeEvent({ type: 'response', content: e.content, sessionId, agentId: e.agentId }),
      tool_data: (e) => writeEvent({ type: 'tool_data', content: e.content, partType: e.partType, field: e.field, sessionId, agentId: e.agentId }),
      done: (e) => writeEvent({ type: 'done', ocSessionId: e.ocSessionId, hash: e.hash, agentId: e.agentId, fullResponse: e.fullResponse, thinking: e.thinking, diff: e.diff }),
      error: (e) => writeEvent({ type: 'error', content: e.content, agentId: e.agentId }),
    };

    await runOpencodePrompt({
      sessionId, prompt, provider, model, thinking, mode, temperature,
      workspaceIds: wsIds,
      onEvent: (event) => { const fn = map[event.type]; if (fn) fn(event); },
    });

    if (sseStarted) {
      res.end();
    } else {
      res.json({ success: true });
    }
  } catch (err) {
    console.log('Error en opencode/send:', err.message);
    if (!sseStarted) {
      const status = (err.status >= 400 && err.status < 500) ? err.status : 500;
      if (res.headersSent) {
        res.end();
      } else {
        res.status(status).json({ error: err.message });
      }
    } else {
      // El evento de error ya fue emitido por runOpencodePrompt sobre el stream
      try { res.end(); } catch (endErr) { console.log('Error al cerrar stream SSE:', endErr.message); }
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

    const remaining = await opencode.listSessions(sessionId);
    if (remaining.length === 0) {
      opencode.stopServer(sessionId);
    }

    res.json({ success: true, hash: ocSessionId });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.post('/close-agent', async (req, res) => {
  if (!authGuard(req, res)) return;
  try {
    const { ocSessionId, sessionId } = req.body;
    if (!ocSessionId) return res.status(400).json({ error: 'ocSessionId requerido' });
    if (!sessionId) return res.status(400).json({ error: 'sessionId requerido' });

    try { await opencode.abortSessionInDir(sessionId, ocSessionId); } catch (abortErr) {
      console.log('Error al abortar sesión OpenCode en /close-agent:', abortErr.message);
    }

    const remaining = await opencode.listSessions(sessionId);
    if (remaining.length === 0) {
      opencode.stopServer(sessionId);
    }

    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.get('/sessions', async (req, res) => {
  if (!authGuard(req, res)) return;
  try {
    const { sessionId } = req.query;
    if (!sessionId) return res.status(400).json({ error: 'sessionId requerido' });

    const sessions = await opencode.listSessions(sessionId);
    res.json({ sessions });
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
    const localeRow = await dbConfig('settings').where({ workspace_id: wsId, setting_key: 'locale' }).first();
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
    const localeRow = await dbConfig('settings').where({ workspace_id: wsId, setting_key: 'locale' }).first();
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

  const { sessionId } = req.body

  try {
    let projectRoot = path.resolve(__dirname, '../../..')
    if (sessionId) {
      const chatSession = await db('chat_sessions').where({ id: sessionId }).select('cwd').first()
      if (chatSession && chatSession.cwd) {
        projectRoot = chatSession.cwd
      }
    }

    const targetSkillsDir = path.join(projectRoot, '.opencode', 'skills')

    let copiedCount = 0
    let skippedCount = 0
    let errorsCount = 0

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
        const skillsDir = path.resolve(repoDir, relPath)
        if (!fs.existsSync(skillsDir)) continue

        const entries = fs.readdirSync(skillsDir, { withFileTypes: true })
        for (const entry of entries) {
          try {
            let skillName = null
            let sourcePath = null

            if (entry.isDirectory()) {
              sourcePath = path.join(skillsDir, entry.name, 'SKILL.md')
              skillName = entry.name
            } else if (entry.isFile() && entry.name.endsWith('.md') && entry.name !== 'SKILL.md') {
              sourcePath = path.join(skillsDir, entry.name)
              skillName = entry.name.slice(0, -3)
            }

            if (!skillName || !sourcePath || !fs.existsSync(sourcePath)) continue

            const targetDir = path.join(targetSkillsDir, skillName)
            const targetPath = path.join(targetDir, 'SKILL.md')

            if (fs.existsSync(targetPath)) {
              const sourceContent = fs.readFileSync(sourcePath, 'utf-8')
              const targetContent = fs.readFileSync(targetPath, 'utf-8')
              if (sourceContent === targetContent) {
                skippedCount++
                continue
              }
            }

            fs.mkdirSync(targetDir, { recursive: true })
            fs.copyFileSync(sourcePath, targetPath)
            copiedCount++
          } catch (err) {
            console.log(`[opencode] Error copiando skill '${entry.name}':`, err.message)
            errorsCount++
          }
        }
      }
    }

    // Actualizar .opencode/opencode.json para que OpenCode detecte los skills copiados
    const configDir = path.join(projectRoot, '.opencode')
    const configPath = path.join(configDir, 'opencode.json')
    let config = { $schema: 'https://opencode.ai/config.json', skills: { paths: [] } }
    if (fs.existsSync(configPath)) {
      try {
        config = JSON.parse(fs.readFileSync(configPath, 'utf-8'))
      } catch (parseErr) {
        console.log('[opencode] Error parseando config, se sobrescribirá:', parseErr.message)
      }
    }
    if (!config.skills) config.skills = {}
    if (!Array.isArray(config.skills.paths)) config.skills.paths = []

    const desiredPaths = ['.opencode/skills']
    const existingPaths = new Set(config.skills.paths.map(p => path.resolve(projectRoot, p)))
    let configChanged = false

    for (const relPath of desiredPaths) {
      const absPath = path.resolve(projectRoot, relPath)
      if (fs.existsSync(absPath) && !existingPaths.has(absPath)) {
        config.skills.paths.push(relPath)
        existingPaths.add(absPath)
        configChanged = true
      }
    }

    if (configChanged) {
      if (!fs.existsSync(configDir)) {
        fs.mkdirSync(configDir, { recursive: true })
      }
      config.$schema = 'https://opencode.ai/config.json'
      fs.writeFileSync(configPath, JSON.stringify(config, null, 2), 'utf-8')
      console.log(`[opencode] Config actualizada en ${configPath}`)
    }

    const parts = []
    if (copiedCount > 0) parts.push(`${copiedCount} skill(s) copiados`)
    if (skippedCount > 0) parts.push(`${skippedCount} sin cambios`)
    if (errorsCount > 0) parts.push(`${errorsCount} con errores`)
    if (configChanged) parts.push('config actualizada')
    const message = parts.length > 0
      ? `Skills de los espacios de trabajo sincronizados: ${parts.join(', ')}.`
      : 'No se encontraron skills para copiar de los espacios de trabajo seleccionados.'

    ensureGitignore(targetSkillsDir)

    console.log(`[opencode] Skills copiados a ${targetSkillsDir}: ${copiedCount} copiados, ${skippedCount} omitidos, ${errorsCount} errores`)
    res.json({
      success: true,
      message,
      copied: copiedCount,
      skipped: skippedCount,
      errors: errorsCount,
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
