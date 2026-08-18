import { EventEmitter } from 'events';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import db from '../config/db.js';
import dbConfig from '../config/dbConfig.js';
import dbChatMessages from '../config/dbChatMessages.js';
import opencode from './opencode.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

export const OPENCODE_DEV_DIR = path.resolve(__dirname, '../../../opencode_dev');
export const MAX_MSG_LENGTH = 50000;
export const MAX_SKILL_CHARS = 4000;

export const controlEmitter = new EventEmitter();
controlEmitter.setMaxListeners(100);

let agentIdCounter = 1;

export async function saveLongMessage(sessionId, role, content, extraFields = {}) {
  if (!content) {
    await dbChatMessages('chat_messages').insert({ session_id: sessionId, role, content: '(sin respuesta)', ...extraFields });
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

  await dbChatMessages('chat_messages').insert(inserts);
}

export function getRepoSkillPaths(repoDir) {
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

export function ensureGitignore(dir) {
  const gitignorePath = path.join(dir, '.gitignore')
  if (!fs.existsSync(gitignorePath)) {
    fs.mkdirSync(dir, { recursive: true })
    fs.writeFileSync(gitignorePath, '*\n!.gitignore\n', 'utf-8')
    console.log(`[opencode] .gitignore creado en ${gitignorePath}`)
  }
}

export async function mergeWorkspaceSkillPaths(cwd, workspaceIds) {
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

export async function loadWorkspaceSkillContents(workspaceId) {
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

/**
 * Ejecuta un prompt contra el agente OpenCode y emite eventos vía onEvent.
 *
 * Eventos emitidos (objeto):
 *  - { type: 'thinking', content, sessionId, agentId }
 *  - { type: 'tool_call', content, field, sessionId, agentId }
 *  - { type: 'tool_result', content, field, sessionId, agentId }
 *  - { type: 'response', content, sessionId, agentId }
 *  - { type: 'tool_data', content, partType, field, sessionId, agentId }
 *  - { type: 'terminal', line, partType, sessionId, agentId }
 *  - { type: 'control', control, sessionId, agentId }
 *  - { type: 'done', ocSessionId, hash, agentId, fullResponse, thinking, diff }
 *  - { type: 'error', content, agentId }
 *
 * El control se confirma emitiendo en `controlEmitter` con la clave `control-<controlId>`
 * (ver handleSendControl en interfaz_remota).
 *
 * @param {object} opts
 * @param {number|string} [opts.sessionId]
 * @param {string} opts.prompt
 * @param {string} [opts.provider]
 * @param {string} [opts.model]
 * @param {string} [opts.thinking]
 * @param {string} [opts.mode]
 * @param {string|number} [opts.temperature]
 * @param {number[]} [opts.workspaceIds]
 * @param {(event: object) => void} opts.onEvent
 */
export async function runOpencodePrompt({ sessionId, prompt, provider, model, thinking, mode, temperature, workspaceIds = [1], onEvent }) {
  if (!prompt) {
    throw Object.assign(new Error('prompt requerido'), { status: 400 });
  }
  if (typeof onEvent !== 'function') {
    throw Object.assign(new Error('onEvent requerido'), { status: 400 });
  }

  let cwd = process.cwd();
  if (sessionId) {
    const chatSession = await db('chat_sessions').where({ id: sessionId }).select('cwd').first();
    if (chatSession && chatSession.cwd) cwd = chatSession.cwd;
  }

  const wsId = (workspaceIds && workspaceIds[0]) || 1;
  const localeRow = await dbConfig('settings').where({ workspace_id: wsId, setting_key: 'locale' }).first();
  const locale = localeRow ? localeRow.setting_value : 'es_ES.UTF-8';
  await mergeWorkspaceSkillPaths(cwd, workspaceIds);
  const server = await opencode.getOrStartServer(cwd, sessionId, locale);

  // Enforce terminal limit: block if at capacity
  if (sessionId) {
    const maxTerminalsRow = await dbConfig('settings').where({ workspace_id: wsId, setting_key: 'terminal_max_terminals' }).first();
    const maxTerminals = maxTerminalsRow ? parseInt(maxTerminalsRow.setting_value, 10) || 5 : 5;
    const activeSessions = await opencode.listSessions(sessionId);
    if (activeSessions.length >= maxTerminals) {
      throw Object.assign(new Error(`Límite de agentes alcanzado (${maxTerminals}). Cerrá un agente existente antes de abrir uno nuevo.`), { status: 429 });
    }
  }

  const agentName = mode === 'Plan' ? 'plan' : 'build';
  const agentId = 'agent-' + (agentIdCounter++) + '-' + Date.now();
  const ocSession = await server.createSession('Agent Orchestrator - ' + (prompt.slice(0, 50)), agentName);
  const ocSessionId = ocSession.id;

  if (sessionId) {
    await dbChatMessages('chat_messages').insert({
      session_id: sessionId, role: 'user', content: prompt,
    });
    await db('chat_sessions').where({ id: sessionId }).update({ updated_at: db.fn.now() });
  }

  const processControl = async (controlEvent) => {
    return new Promise((resolve) => {
      const controlId = Date.now() + Math.random();
      const controlData = { ...controlEvent, controlId };

      onEvent({ type: 'control', control: controlData, sessionId, agentId });

      if (sessionId) {
        dbChatMessages('chat_messages').insert({
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
          onEvent({ type: 'thinking', content: delta, sessionId, agentId });
        } else if (partType === 'tool_call') {
          let toolName = delta;
          try { const p = JSON.parse(delta); if (p.name) toolName = p.name; if (p.arguments) toolName += ' ' + JSON.stringify(p.arguments); } catch (err) { console.log('[opencode] Error al parsear tool call delta:', err.message); }
          terminalLine = `\x1b[38;5;214m$ ${toolName}\x1b[0m`;
          onEvent({ type: 'tool_call', content: delta, field, sessionId, agentId });
        } else if (partType === 'tool_result') {
          terminalLine = `\x1b[38;5;246m${delta}\x1b[0m`;
          onEvent({ type: 'tool_result', content: delta, field, sessionId, agentId });
        } else if (field === 'text') {
          fullResponse += delta;
          terminalLine = delta;
          onEvent({ type: 'response', content: delta, sessionId, agentId });
        } else {
          onEvent({ type: 'tool_data', content: delta, partType, field, sessionId, agentId });
        }
        if (terminalLine) {
          onEvent({ type: 'terminal', line: terminalLine, partType, sessionId, agentId });
        }
      }

      if (event.type === 'session.status' && event.properties?.status?.type === 'idle') {
        break;
      }
    }

    const diff = await server.getSessionDiff(ocSessionId);

    onEvent({ type: 'terminal', line: '', partType: 'separator', sessionId, agentId });
    if (diff && diff.length > 0) {
      for (const d of diff) {
        onEvent({ type: 'terminal', line: `\x1b[38;5;39m📁 ${d.path} (\x1b[38;5;214m${d.type || 'modificado'}\x1b[38;5;39m)\x1b[0m`, partType: 'diff', sessionId, agentId });
      }
    }
    onEvent({ type: 'terminal', line: '\x1b[38;5;40m✅ Hecho.\x1b[0m', partType: 'done', sessionId, agentId });

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

    onEvent({ type: 'done', ocSessionId, hash: ocSessionId, agentId, fullResponse, thinking: fullThinking, diff: diff || [] });
    return { success: true, ocSessionId, fullResponse, diff: diff || [] };
  } catch (msgErr) {
    console.log('Error en opencode streamSession:', msgErr.message);
    onEvent({ type: 'error', content: msgErr.message, agentId });
    if (sessionId) {
      try {
        await saveLongMessage(sessionId, 'opencode_result', JSON.stringify({ error: msgErr.message }));
        await saveLongMessage(sessionId, 'opencode_info', JSON.stringify({ type: 'error', error: msgErr.message }));
      } catch (e) {
        console.log('Error al guardar mensajes de error:', e.message);
      }
    }
    await registrarGastos(sessionId, ocSessionId, server, fullResponse).catch((e) => console.log('[gastos] error en catch post-error:', e.message));
    throw msgErr;
  }
}

export default {
  controlEmitter,
  saveLongMessage,
  mergeWorkspaceSkillPaths,
  loadWorkspaceSkillContents,
  getRepoSkillPaths,
  ensureGitignore,
  runOpencodePrompt,
  MAX_MSG_LENGTH,
  MAX_SKILL_CHARS,
};
