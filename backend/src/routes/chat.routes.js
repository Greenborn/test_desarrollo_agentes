import { Router } from 'express';
import db from '../config/db.js';
import { streamChat } from '../services/deepseek.js';

const router = Router();

function authGuard(req, res) {
  if (!req.session?.userId) {
    res.status(401).json({ error: 'Sesión no válida' });
    return false;
  }
  return true;
}

function generateTitle() {
  const now = new Date();
  const pad = (n) => String(n).padStart(2, '0');
  return `${pad(now.getDate())}/${pad(now.getMonth() + 1)} ${pad(now.getHours())}:${pad(now.getMinutes())}`;
}

router.get('/sessions', async (req, res) => {
  if (!authGuard(req, res)) return;
  try {
    const wsIds = req.session.workspaceIds || [1];
    const sessions = await db('chat_sessions')
      .where({ 'chat_sessions.user_id': req.session.userId })
      .whereIn('chat_sessions.workspace_id', wsIds)
      .orderBy('chat_sessions.updated_at', 'desc')
      .leftJoin('proyectos', 'chat_sessions.proyecto_id', 'proyectos.id')
      .leftJoin('tickets', 'chat_sessions.id_ticket_redmine', 'tickets.redmine_id')
      .leftJoin('settings as ws_redmine', function () {
        this.on('chat_sessions.workspace_id', '=', 'ws_redmine.workspace_id')
          .andOn('ws_redmine.setting_key', '=', db.raw('?', ['redmine_url']));
      })
      .select(
        'chat_sessions.id',
        'title',
        'chat_sessions.updated_at',
        'cwd',
        'chat_sessions.proyecto_id',
        'id_ticket_redmine',
        'chat_sessions.workspace_id',
        'ws_redmine.setting_value as session_redmine_url',
        'proyectos.descripcion as proyecto_descripcion',
        'tickets.priority_id',
        'tickets.priority_name'
      );
    res.json({ sessions });
  } catch (err) {
    console.log('Error al cargar sesiones:', err.message);
    res.status(500).json({ sessions: [], error: err.message });
  }
});

router.post('/sessions', async (req, res) => {
  if (!authGuard(req, res)) return;
  try {
    const wsIds = req.session.workspaceIds || [1];
    const wsId = req.body.workspace_id && wsIds.includes(req.body.workspace_id) ? req.body.workspace_id : wsIds[0] || 1;
    const title = generateTitle();
    const cwd = req.body.cwd ? req.body.cwd : process.cwd();
    const [id] = await db('chat_sessions').insert({ user_id: req.session.userId, workspace_id: wsId, title, cwd });
    const session = await db('chat_sessions').where({ id }).first();
    res.status(201).json({ session });
  } catch (err) {
    console.log('Error al crear sesión:', err.message);
    res.status(500).json({ session: null, error: err.message });
  }
});

router.get('/sessions/:id/messages', async (req, res) => {
  if (!authGuard(req, res)) return;
  try {
    const messages = await db('chat_messages')
      .where({ session_id: req.params.id })
      .orderBy('created_at', 'asc')
      .select('id', 'role', 'content', 'thinking', 'created_at');
    res.json({ sessionId: Number(req.params.id), messages });
  } catch (err) {
    console.log('Error al cargar mensajes:', err.message);
    res.status(500).json({ sessionId: Number(req.params.id), messages: [], error: err.message });
  }
});

router.post('/sessions/:id/messages', async (req, res) => {
  if (!authGuard(req, res)) return;
  const sessionId = req.params.id;
  const { message } = req.body;

  try {
    const session = await db('chat_sessions').where({ id: sessionId, user_id: req.session.userId }).first();
    if (!session) {
      return res.status(404).json({ error: 'Sesión no encontrada' });
    }
    await db('chat_messages').insert({ session_id: sessionId, role: 'user', content: message });
    await db('chat_sessions').where({ id: sessionId }).update({ updated_at: db.fn.now() });

    const history = await db('chat_messages')
      .where({ session_id: sessionId })
      .orderBy('created_at', 'asc')
      .select('role', 'content');

    res.writeHead(200, {
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache',
      'Connection': 'keep-alive',
    });

    let fullThinking = '';
    let fullResponse = '';
    let usageData = null;

    const wsId = session.workspace_id || (req.session.workspaceIds || [1])[0] || 1;
    for await (const chunk of streamChat(history, wsId)) {
      if (chunk.type === 'usage') {
        usageData = chunk;
        continue;
      }
      if (chunk.type === 'thinking') {
        fullThinking += chunk.content;
      } else {
        fullResponse += chunk.content;
      }
      res.write(`data: ${JSON.stringify({ ...chunk, sessionId })}\n\n`);
    }

    await db('chat_messages').insert({
      session_id: sessionId,
      role: 'assistant',
      content: fullResponse,
      thinking: fullThinking ? fullThinking : null,
    });
    await db('chat_sessions').where({ id: sessionId }).update({ updated_at: db.fn.now() });

    if (usageData) {
      try {
        const chatSess = await db('chat_sessions').where({ id: sessionId }).select('proyecto_id').first();
        const idProyecto = chatSess?.proyecto_id;
        if (idProyecto) {
          const gastosPort = process.env.SERVICIO_GASTOS_PORT || 4100;
          const precio = (usageData.completion_tokens || 0) * 0.0000011;
          await fetch(`http://localhost:${gastosPort}/api/gastos/register`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              id_chat_session: parseInt(sessionId),
              id_proyecto: idProyecto,
              precio: precio,
              tokens: usageData.total_tokens || 0,
            }),
          });
        }
      } catch (e) {
        console.log('[gastos] error al registrar en chat normal:', e.message);
      }
    }

    res.write(`data: ${JSON.stringify({ type: 'done', sessionId })}\n\n`);
    res.end();
  } catch (err) {
    console.log('Error al enviar mensaje:', err.message);
    if (res.headersSent) {
      res.write(`data: ${JSON.stringify({ type: 'error', content: err.message })}\n\n`);
      res.end();
    } else {
      res.status(500).json({ error: err.message });
    }
  }
});

router.post('/sessions/:id/save-messages', async (req, res) => {
  if (!authGuard(req, res)) return;
  const { messages } = req.body;
  if (!Array.isArray(messages) || messages.length === 0) {
    return res.status(400).json({ error: 'Se requiere un array messages no vacío' });
  }
  try {
    const session = await db('chat_sessions').where({ id: req.params.id, user_id: req.session.userId }).first();
    if (!session) {
      return res.status(404).json({ error: 'Sesión no encontrada' });
    }
    const inserts = messages.map(m => ({
      session_id: req.params.id,
      role: m.role,
      content: m.content,
      thinking: m.thinking || null,
    }));
    await db('chat_messages').insert(inserts);
    await db('chat_sessions').where({ id: req.params.id }).update({ updated_at: db.fn.now() });
    res.json({ success: true });
  } catch (err) {
    console.log('Error al guardar mensajes:', err.message);
    res.status(500).json({ success: false, error: err.message });
  }
});

router.delete('/sessions/:sessionId/messages/:messageId', async (req, res) => {
  if (!authGuard(req, res)) return;
  try {
    const session = await db('chat_sessions').where({ id: req.params.sessionId, user_id: req.session.userId }).first();
    if (!session) return res.status(404).json({ error: 'Sesión no encontrada' });
    const deleted = await db('chat_messages').where({ id: req.params.messageId, session_id: req.params.sessionId }).del();
    if (!deleted) return res.status(404).json({ error: 'Mensaje no encontrado' });
    res.json({ success: true });
  } catch (err) {
    console.log('Error al eliminar mensaje:', err.message);
    res.status(500).json({ success: false, error: err.message });
  }
});

router.delete('/sessions/:id/messages', async (req, res) => {
  if (!authGuard(req, res)) return;
  try {
    const session = await db('chat_sessions').where({ id: req.params.id, user_id: req.session.userId }).first();
    if (!session) return res.status(404).json({ error: 'Sesión no encontrada' });
    await db('chat_messages').where({ session_id: req.params.id }).del();
    res.json({ success: true, sessionId: req.params.id });
  } catch (err) {
    console.log('Error al limpiar mensajes:', err.message);
    res.status(500).json({ success: false, error: err.message });
  }
});

router.post('/refine', async (req, res) => {
  if (!authGuard(req, res)) return;
  const { text, systemPrompt, sessionId } = req.body;
  if (!text) return res.status(400).json({ error: 'text requerido' });
  if (!systemPrompt) return res.status(400).json({ error: 'systemPrompt requerido' });

  let wsId = (req.session.workspaceIds || [1])[0] || 1;
  if (sessionId) {
    const sess = await db('chat_sessions').where({ id: sessionId }).select('workspace_id').first();
    if (sess && sess.workspace_id) wsId = sess.workspace_id;
  }
  const messages = [{ role: 'user', content: text }];

  res.writeHead(200, {
    'Content-Type': 'text/event-stream',
    'Cache-Control': 'no-cache',
    'Connection': 'keep-alive',
  });

  let usageData = null;

  try {
    for await (const chunk of streamChat(messages, wsId, systemPrompt)) {
      if (chunk.type === 'usage') {
        usageData = chunk;
        continue;
      }
      res.write(`data: ${JSON.stringify(chunk)}\n\n`);
    }

    if (usageData && sessionId) {
      try {
        const chatSess = await db('chat_sessions').where({ id: sessionId }).select('proyecto_id').first();
        const idProyecto = chatSess?.proyecto_id;
        if (idProyecto) {
          const gastosPort = process.env.SERVICIO_GASTOS_PORT || 4100;
          const precio = (usageData.completion_tokens || 0) * 0.0000011;
          await fetch(`http://localhost:${gastosPort}/api/gastos/register`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              id_chat_session: parseInt(sessionId),
              id_proyecto: idProyecto,
              precio: precio,
              tokens: usageData.total_tokens || 0,
            }),
          });
        }
      } catch (e) {
        console.log('[gastos] error al registrar en refine:', e.message);
      }
    }

    res.write('data: {"type":"done"}\n\n');
    res.end();
  } catch (err) {
    console.log('Error en refine:', err.message);
    if (res.headersSent) {
      res.write(`data: ${JSON.stringify({ type: 'error', content: err.message })}\n\n`);
      res.end();
    } else {
      res.status(500).json({ error: err.message });
    }
  }
});

router.post('/summarize-file', async (req, res) => {
  if (!authGuard(req, res)) return;
  try {
    const { fileContent, filePath, sessionId, model, thinking } = req.body;
    if (!fileContent) return res.status(400).json({ error: 'fileContent requerido' });

    const systemPrompt = 'Describí el propósito del siguiente archivo de código en no más de 300 caracteres. Sé conciso y específico. Describí únicamente su funcionalidad principal, sin detallar implementación interna.';
    const message = `Archivo: ${filePath || 'sin nombre'}\n\n\`\`\`\n${fileContent.slice(0, 8000)}\n\`\`\``;
    const messages = [{ role: 'user', content: message }];

    let wsId = (req.session.workspaceIds || [1])[0] || 1;
    if (sessionId) {
      const sess = await db('chat_sessions').where({ id: sessionId }).select('workspace_id').first();
      if (sess && sess.workspace_id) wsId = sess.workspace_id;
    }
    const streamOptions = {};
    if (model) streamOptions.model = model;
    if (thinking) streamOptions.reasoningEffort = thinking;

    let description = '';
    let usageData = null;

    for await (const chunk of streamChat(messages, wsId, systemPrompt, streamOptions)) {
      if (chunk.type === 'usage') {
        usageData = chunk;
        continue;
      }
      if (chunk.type === 'response') {
        description += chunk.content;
      }
    }

    if (usageData && sessionId) {
      try {
        const chatSess = await db('chat_sessions').where({ id: sessionId }).select('proyecto_id').first();
        const idProyecto = chatSess?.proyecto_id;
        if (idProyecto) {
          const gastosPort = process.env.SERVICIO_GASTOS_PORT || 4100;
          const precio = (usageData.completion_tokens || 0) * 0.0000011;
          await fetch(`http://localhost:${gastosPort}/api/gastos/register`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              id_chat_session: parseInt(sessionId),
              id_proyecto: idProyecto,
              precio: precio,
              tokens: usageData.total_tokens || 0,
            }),
          });
        }
      } catch (e) {
        console.log('[gastos] error al registrar en summarize-file:', e.message);
      }
    }

    const trimmed = description.slice(0, 300).trim();
    res.json({ description: trimmed || '(sin descripción)' });
  } catch (err) {
    console.log('Error en summarize-file:', err.message);
    res.status(500).json({ error: err.message });
  }
});

router.post('/summarize-files-batch', async (req, res) => {
  if (!authGuard(req, res)) return;
  try {
    const { files, model, thinking, sessionId } = req.body;
    if (!Array.isArray(files) || files.length === 0) {
      return res.status(400).json({ error: 'files debe ser un arreglo no vacío' });
    }

    const parts = files.map((f, i) => {
      const content = (f.content || '').slice(0, 8000);
      return `[Archivo ${i + 1}]\nRuta: ${f.path || 'sin nombre'}\n\`\`\`\n${content}\n\`\`\``;
    });

    const systemPrompt = 'Analizá los siguientes archivos de código. Para cada uno, devolvé una descripción de máximo 300 caracteres describiendo su propósito y funcionalidad principal.';
    const message = `Respondé ÚNICAMENTE con un objeto JSON válido donde las claves sean las rutas de los archivos y los valores sean las descripciones. Sin explicaciones ni texto adicional.\n\n${parts.join('\n\n')}`;
    const messages = [{ role: 'user', content: message }];

    let wsId = (req.session.workspaceIds || [1])[0] || 1;
    if (sessionId) {
      const sess = await db('chat_sessions').where({ id: sessionId }).select('workspace_id').first();
      if (sess && sess.workspace_id) wsId = sess.workspace_id;
    }
    const streamOptions = {};
    if (model) streamOptions.model = model;
    if (thinking) streamOptions.reasoningEffort = thinking;

    let rawResponse = '';
    let usageData = null;

    for await (const chunk of streamChat(messages, wsId, systemPrompt, streamOptions)) {
      if (chunk.type === 'usage') {
        usageData = chunk;
        continue;
      }
      if (chunk.type === 'response') {
        rawResponse += chunk.content;
      }
    }

    if (usageData && sessionId) {
      try {
        const chatSess = await db('chat_sessions').where({ id: sessionId }).select('proyecto_id').first();
        const idProyecto = chatSess?.proyecto_id;
        if (idProyecto) {
          const gastosPort = process.env.SERVICIO_GASTOS_PORT || 4100;
          const precio = (usageData.completion_tokens || 0) * 0.0000011;
          await fetch(`http://localhost:${gastosPort}/api/gastos/register`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              id_chat_session: parseInt(sessionId),
              id_proyecto: idProyecto,
              precio: precio,
              tokens: usageData.total_tokens || 0,
            }),
          });
        }
      } catch (e) {
        console.log('[gastos] error al registrar en summarize-files-batch:', e.message);
      }
    }

    let descriptions = {};
    try {
      const trimmed = rawResponse.trim();
      const jsonStart = trimmed.indexOf('{');
      const jsonEnd = trimmed.lastIndexOf('}');
      if (jsonStart >= 0 && jsonEnd > jsonStart) {
        descriptions = JSON.parse(trimmed.slice(jsonStart, jsonEnd + 1));
      }
    } catch (e) {
      console.log('Error parseando JSON de batch:', e.message);
    }

    for (const f of files) {
      if (!descriptions[f.path]) {
        descriptions[f.path] = '(sin descripción)';
      }
    }

    res.json({ descriptions });
  } catch (err) {
    console.log('Error en summarize-files-batch:', err.message);
    res.status(500).json({ error: err.message });
  }
});

router.delete('/sessions/:id', async (req, res) => {
  if (!authGuard(req, res)) return;
  try {
    await db('chat_messages').where({ session_id: req.params.id }).del();
    await db('chat_sessions').where({ id: req.params.id }).del();
    res.json({ success: true, sessionId: req.params.id });
  } catch (err) {
    console.log('Error al eliminar sesión:', err.message);
    res.status(500).json({ success: false, sessionId: req.params.id, error: err.message });
  }
});

export default router;
