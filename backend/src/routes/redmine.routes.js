import { Router } from 'express';
import { getRedmineToken, getRedmineUrl } from '../services/redmine.js';
import db from '../config/db.js';

const router = Router();

function slugify(text) {
  return text
    .toLowerCase()
    .replace(/[^a-z0-9 ]/g, '')
    .replace(/ /g, '_')
    .replace(/_+/g, '_')
    .replace(/^_|_$/g, '');
}

function toDateTime(dateStr) {
  if (!dateStr) return null;
  const d = new Date(dateStr);
  if (isNaN(d.getTime())) return dateStr;
  return d.toISOString().replace('T', ' ').replace('Z', '').split('.')[0];
}

function authGuard(req, res) {
  if (!req.session?.userId) {
    res.status(401).json({ error: 'Sesión no válida' });
    return false;
  }
  return true;
}

router.post('/test', async (req, res) => {
  if (!authGuard(req, res)) return;

  try {
    const wsIds = req.session.workspaceIds || [1];
    const wsId = wsIds[0] || 1;
    const token = await getRedmineToken(wsId);
    const url = await getRedmineUrl(wsId);

    if (!token || !url) {
      res.json({
        success: false,
        message: 'Token o URL de Redmine no configurados. Configure ambos en Configuración.',
      });
      return;
    }

    const apiUrl = url.replace(/\/+$/, '') + '/projects.json';

    const response = await fetch(apiUrl, {
      headers: {
        'X-Redmine-API-Key': token,
        'Content-Type': 'application/json',
      },
    });

    if (response.ok) {
      res.json({ success: true, message: 'Conexión exitosa a Redmine.' });
    } else {
      const text = await response.text();
      res.json({
        success: false,
        message: `Error de conexión: HTTP ${response.status}${text ? ' — ' + text.slice(0, 200) : ''}`,
      });
    }
  } catch (err) {
    console.log('Error al probar conexión Redmine:', err.message);
    res.json({ success: false, message: 'Error al conectar con Redmine: ' + err.message });
  }
});

router.get('/proyectos', async (req, res) => {
  if (!authGuard(req, res)) return;

  try {
    const wsIds = req.session.workspaceIds || [1];
    const wsId = wsIds[0] || 1;
    const token = await getRedmineToken(wsId);
    const url = await getRedmineUrl(wsId);

    if (!token || !url) {
      res.json({
        success: false,
        message: 'Token o URL de Redmine no configurados. Configure ambos en Configuración.',
      });
      return;
    }

    const apiUrl = url.replace(/\/+$/, '') + '/projects.json?include=time_entry_activities,issue_categories,enabled_modules';

    const response = await fetch(apiUrl, {
      headers: {
        'X-Redmine-API-Key': token,
        'Content-Type': 'application/json',
      },
    });

    if (!response.ok) {
      const text = await response.text();
      res.json({
        success: false,
        message: `Error al obtener proyectos: HTTP ${response.status}${text ? ' — ' + text.slice(0, 200) : ''}`,
      });
      return;
    }

    const data = await response.json();
    const proyectos = (data.projects || []).map((p) => ({
      id: p.id,
      name: p.name,
      identifier: p.identifier,
      description: p.description || '',
      status: p.status,
      created_on: p.created_on,
      updated_on: p.updated_on,
      parent: p.parent ? { id: p.parent.id, name: p.parent.name } : null,
      slug: slugify(p.name),
    }));

    res.json({ success: true, proyectos });
  } catch (err) {
    console.log('Error al obtener proyectos Redmine:', err.message);
    res.json({ success: false, message: 'Error al obtener proyectos Redmine: ' + err.message });
  }
});

router.post('/proyectos/import-all', async (req, res) => {
  if (!authGuard(req, res)) return;

  try {
    const wsIds = req.session.workspaceIds || [1];
    const wsId = wsIds[0] || 1;
    const token = await getRedmineToken(wsId);
    const url = await getRedmineUrl(wsId);

    if (!token || !url) {
      res.json({
        success: false,
        message: 'Token o URL de Redmine no configurados. Configure ambos en Configuración.',
      });
      return;
    }

    const baseUrl = url.replace(/\/+$/, '') + '/projects.json';
    let allProjects = [];
    let offset = 0;
    const limit = 100;

    while (true) {
      const apiUrl = `${baseUrl}?limit=${limit}&offset=${offset}&include=time_entry_activities,issue_categories,enabled_modules`;
      const response = await fetch(apiUrl, {
        headers: {
          'X-Redmine-API-Key': token,
          'Content-Type': 'application/json',
        },
      });

      if (!response.ok) {
        const text = await response.text();
        res.json({
          success: false,
          message: `Error al obtener proyectos: HTTP ${response.status}${text ? ' — ' + text.slice(0, 200) : ''}`,
        });
        return;
      }

      const data = await response.json();
      allProjects = allProjects.concat(data.projects || []);

      const total = data.total_count || allProjects.length;
      if (allProjects.length >= total) break;
      offset += limit;
    }

    const importados = [];
    const yaExistentes = [];
    const errores = [];

    for (const p of allProjects) {
      try {
        const proyectoId = slugify(p.name);
        if (!proyectoId) {
          errores.push({ id: p.id, name: p.name, error: 'No se pudo generar slug desde el nombre.' });
          continue;
        }

        const existing = await db('proyectos').where({ redmine_id: p.id }).first();
        const wsIds = req.session.workspaceIds || [1];
        const wsId = wsIds[0] || 1;

        if (existing) {
          await db('proyectos').where({ redmine_id: p.id }).update({
            descripcion: p.description || '',
            redmine_status: p.status || null,
            redmine_updated_on: toDateTime(p.updated_on),
            redmine_parent_id: p.parent?.id ? String(p.parent.id) : null,
            redmine_parent_name: p.parent?.name || null,
            workspace_id: wsId,
          });
          yaExistentes.push({ id: p.id, name: p.name, identifier: p.identifier });
          continue;
        }

        await db('proyectos').insert({
          id: proyectoId,
          descripcion: p.description || '',
          redmine_id: p.id,
          redmine_status: p.status || null,
          redmine_created_on: toDateTime(p.created_on),
          redmine_updated_on: toDateTime(p.updated_on),
          redmine_parent_id: p.parent?.id ? String(p.parent.id) : null,
          redmine_parent_name: p.parent?.name || null,
          workspace_id: wsId,
        });

        importados.push({ id: p.id, name: p.name, identifier: p.identifier });
      } catch (err) {
        console.log('Error al importar proyecto Redmine:', p.id, p.name, err.message);
        errores.push({ id: p.id, name: p.name, error: err.message });
      }
    }

    res.json({
      success: true,
      importados,
      yaExistentes,
      errores,
      total: allProjects.length,
    });
  } catch (err) {
    console.log('Error en import-all Redmine:', err.message);
    res.json({ success: false, message: 'Error al importar proyectos: ' + err.message });
  }
});

router.post('/proyectos/import', async (req, res) => {
  if (!authGuard(req, res)) return;

  const { id, name, description, status, created_on, updated_on, parent } = req.body;

  if (!id || !name) {
    res.json({ success: false, message: 'id y name del proyecto son requeridos.' });
    return;
  }

  const proyectoId = slugify(name);
  if (!proyectoId) {
    res.json({ success: false, message: 'No se pudo generar un slug válido desde el nombre del proyecto.' });
    return;
  }

  try {
    const wsIds = req.session.workspaceIds || [1];
    const wsId = wsIds[0] || 1;

    const existing = await db('proyectos').where({ redmine_id: id }).first();

    const data = {
      descripcion: description || '',
      redmine_id: id,
      redmine_status: status || null,
      redmine_created_on: toDateTime(created_on),
      redmine_updated_on: toDateTime(updated_on),
      redmine_parent_id: parent?.id ? String(parent.id) : null,
      redmine_parent_name: parent?.name || null,
      workspace_id: wsId,
    };

    if (existing) {
      await db('proyectos').where({ redmine_id: id }).update(data);
      res.json({ success: true, proyectoId: existing.id, action: 'updated' });
    } else {
      data.id = proyectoId;
      await db('proyectos').insert(data);
      res.json({ success: true, proyectoId, action: 'imported' });
    }
  } catch (err) {
    console.log('Error al importar proyecto Redmine:', err.message);
    res.json({ success: false, message: 'Error al importar proyecto: ' + err.message });
  }
});

router.get('/proyectos/:proyectoId/tickets', async (req, res) => {
  if (!authGuard(req, res)) return;

  try {
    const wsIds = req.session.workspaceIds || [1];

    const proyecto = await db('proyectos').where({ id: req.params.proyectoId }).whereIn('workspace_id', wsIds).first();

    if (!proyecto) {
      res.json({ success: false, message: `Proyecto "${req.params.proyectoId}" no encontrado en la base local para el workspace activo.` });
      return;
    }

    if (!proyecto.redmine_id) {
      res.json({ success: false, message: `El proyecto "${req.params.proyectoId}" no tiene ID de Redmine asociado.` });
      return;
    }

    const wsId = wsIds[0] || 1;
    const token = await getRedmineToken(wsId);
    const url = await getRedmineUrl(wsId);

    if (!token || !url) {
      res.json({ success: false, message: 'Token o URL de Redmine no configurados. Configure ambos en Configuración.' });
      return;
    }

    const apiUrl = url.replace(/\/+$/, '') + `/issues.json?project_id=${proyecto.redmine_id}&limit=100&sort=updated_on:desc`;

    const response = await fetch(apiUrl, {
      headers: {
        'X-Redmine-API-Key': token,
        'Content-Type': 'application/json',
      },
    });

    if (!response.ok) {
      const text = await response.text();
      res.json({
        success: false,
        message: `Error al obtener tickets: HTTP ${response.status}${text ? ' — ' + text.slice(0, 200) : ''}`,
      });
      return;
    }

    const data = await response.json();

    const tickets = (data.issues || []).map((issue) => ({
      id: issue.id,
      subject: issue.subject || '(sin asunto)',
      status: issue.status?.name || '—',
      priority: issue.priority?.name || '—',
      tracker: issue.tracker?.name || '—',
      assigned_to: issue.assigned_to?.name || null,
      created_on: issue.created_on || null,
      updated_on: issue.updated_on || null,
    }));

    res.json({ success: true, tickets, total: data.total_count || tickets.length });
  } catch (err) {
    console.log('Error al obtener tickets Redmine:', err.message);
    res.json({ success: false, message: 'Error al obtener tickets: ' + err.message });
  }
});

async function importarIssuesDeRedmine(proyecto, token, url, workspaceId) {
  const baseUrl = url.replace(/\/+$/, '') + '/issues.json';
  let allIssues = [];
  let offset = 0;
  const limit = 100;

  while (true) {
    const apiUrl = `${baseUrl}?project_id=${proyecto.redmine_id}&limit=${limit}&offset=${offset}&sort=id`;
    const response = await fetch(apiUrl, {
      headers: {
        'X-Redmine-API-Key': token,
        'Content-Type': 'application/json',
      },
    });

    if (!response.ok) {
      const text = await response.text();
      throw new Error(`HTTP ${response.status}${text ? ' — ' + text.slice(0, 200) : ''}`);
    }

    const data = await response.json();
    allIssues = allIssues.concat(data.issues || []);

    const total = data.total_count || allIssues.length;
    if (allIssues.length >= total) break;
    offset += limit;
  }

  let importados = 0;
  let actualizados = 0;

  for (const issue of allIssues) {
    try {
      const ticketData = {
        proyecto_id: proyecto.id,
        workspace_id: workspaceId || 1,
        redmine_id: issue.id,
        subject: issue.subject || '(sin asunto)',
        description: issue.description || null,
        status_name: issue.status?.name || null,
        tracker_name: issue.tracker?.name || null,
        priority_id: issue.priority?.id || null,
        priority_name: issue.priority?.name || null,
        assigned_to_name: issue.assigned_to?.name || null,
        author_name: issue.author?.name || null,
        start_date: issue.start_date || null,
        due_date: issue.due_date || null,
        estimated_hours: issue.estimated_hours || null,
        done_ratio: issue.done_ratio || null,
        fixed_version_name: issue.fixed_version?.name || null,
        redmine_created_on: toDateTime(issue.created_on),
        redmine_updated_on: toDateTime(issue.updated_on),
        redmine_closed_on: toDateTime(issue.closed_on),
      };

      const existing = await db('tickets').where({ redmine_id: issue.id }).first();
      if (existing) {
        await db('tickets').where({ redmine_id: issue.id }).update(ticketData);
        actualizados++;
      } else {
        await db('tickets').insert(ticketData);
        importados++;
      }
    } catch (err) {
      console.log('Error al guardar ticket Redmine:', issue.id, err.message);
    }
  }

  return { importados, actualizados, total_redmine: allIssues.length };
}

router.post('/proyectos/:proyectoId/importar-tickets', async (req, res) => {
  if (!authGuard(req, res)) return;

  try {
    const wsIds = req.session.workspaceIds || [1];
    const proyecto = await db('proyectos').where({ id: req.params.proyectoId }).whereIn('workspace_id', wsIds).first();

    if (!proyecto) {
      res.json({ success: false, message: `Proyecto "${req.params.proyectoId}" no encontrado en la base local para el workspace activo.` });
      return;
    }

    if (!proyecto.redmine_id) {
      res.json({ success: false, message: `El proyecto "${req.params.proyectoId}" no tiene ID de Redmine asociado.` });
      return;
    }

    const wsId = wsIds[0] || 1;
    const token = await getRedmineToken(wsId);
    const url = await getRedmineUrl(wsId);

    if (!token || !url) {
      res.json({ success: false, message: 'Token o URL de Redmine no configurados. Configure ambos en Configuración.' });
      return;
    }

    const resultado = await importarIssuesDeRedmine(proyecto, token, url, wsId);

    res.json({ success: true, ...resultado });
  } catch (err) {
    console.log('Error al importar tickets Redmine:', err.message);
    res.json({ success: false, message: 'Error al importar tickets: ' + err.message });
  }
});

router.post('/proyectos/importar-tickets-all', async (req, res) => {
  if (!authGuard(req, res)) return;

  try {
    const wsIds = req.session.workspaceIds || [1];
    const wsId = wsIds[0] || 1;
    const token = await getRedmineToken(wsId);
    const url = await getRedmineUrl(wsId);

    if (!token || !url) {
      res.json({ success: false, message: 'Token o URL de Redmine no configurados. Configure ambos en Configuración.' });
      return;
    }

    const proyectos = await db('proyectos').whereIn('workspace_id', wsIds).whereNotNull('redmine_id').orderBy('id');

    if (proyectos.length === 0) {
      res.json({ success: false, message: 'No hay proyectos con ID de Redmine asociado.' });
      return;
    }

    const resultados = [];
    let totalImportados = 0;
    let totalActualizados = 0;

    for (const proyecto of proyectos) {
      try {
        const r = await importarIssuesDeRedmine(proyecto, token, url, wsId);
        resultados.push({
          proyecto_id: proyecto.id,
          importados: r.importados,
          actualizados: r.actualizados,
          total_redmine: r.total_redmine,
        });
        totalImportados += r.importados;
        totalActualizados += r.actualizados;
      } catch (err) {
        resultados.push({
          proyecto_id: proyecto.id,
          error: err.message,
        });
        console.log('Error al importar tickets de', proyecto.id, ':', err.message);
      }
    }

    res.json({
      success: true,
      total_proyectos: proyectos.length,
      resultados,
      totales: { importados: totalImportados, actualizados: totalActualizados },
    });
  } catch (err) {
    console.log('Error al importar tickets de todos los proyectos:', err.message);
    res.json({ success: false, message: 'Error al importar tickets: ' + err.message });
  }
});

router.post('/comments', async (req, res) => {
  if (!authGuard(req, res)) return;

  const { session_id, ticket_redmine_id, comentario, tipo } = req.body;

  if (!session_id) {
    return res.status(400).json({ error: 'session_id es requerido' });
  }
  if (!ticket_redmine_id) {
    return res.status(400).json({ error: 'ticket_redmine_id es requerido' });
  }
  if (!comentario || !comentario.trim()) {
    return res.status(400).json({ error: 'comentario es requerido' });
  }

  try {
    const chatSession = await db('chat_sessions').where({ id: session_id }).select('workspace_id').first();
    const wsId = chatSession?.workspace_id || 1;
    const [insertedId] = await db('redmine_comentarios').insert({
      session_id,
      ticket_redmine_id,
      comentario: comentario.trim(),
      workspace_id: wsId,
      estado: 'pendiente',
      tipo: tipo || 'comentario_commit',
    });

    res.json({ success: true, id: insertedId });
  } catch (err) {
    console.log('Error al encolar comentario Redmine:', err.message);
    res.status(500).json({ error: err.message });
  }
});

router.get('/comments', async (req, res) => {
  if (!authGuard(req, res)) return;

  try {
    let query = db('redmine_comentarios');
    let wsId = null;

    if (req.query.sessionId) {
      const chatSession = await db('chat_sessions').where({ id: req.query.sessionId }).select('workspace_id').first();
      wsId = chatSession?.workspace_id || null;
    }

    if (wsId) {
      query.where({ workspace_id: wsId });
    } else if (req.query.ticket_redmine_id) {
      const ticket = await db('tickets').where({ redmine_id: req.query.ticket_redmine_id }).select('workspace_id').first();
      if (ticket?.workspace_id) {
        query.where({ workspace_id: ticket.workspace_id });
      }
    }

    if (req.query.ticket_redmine_id) {
      query.where({ ticket_redmine_id: parseInt(req.query.ticket_redmine_id, 10) });
    }

    if (req.query.estado && req.query.estado !== 'todos') {
      query.where({ estado: req.query.estado });
    }

    if (req.query.sessionId) {
      query.where({ session_id: parseInt(req.query.sessionId, 10) });
    }

    const comentarios = await query.orderBy('created_at', 'asc');

    res.json({ success: true, comentarios });
  } catch (err) {
    console.log('Error al listar comentarios Redmine:', err.message);
    res.status(500).json({ error: err.message });
  }
});

router.post('/comments/send', async (req, res) => {
  if (!authGuard(req, res)) return;

  const { comentarios_ids, mensaje } = req.body;

  if (!comentarios_ids || !Array.isArray(comentarios_ids) || comentarios_ids.length === 0) {
    return res.status(400).json({ error: 'comentarios_ids debe ser un array no vacío' });
  }
  if (!mensaje || !mensaje.trim()) {
    return res.status(400).json({ error: 'mensaje es requerido' });
  }

  try {
    const comentarios = await db('redmine_comentarios')
      .whereIn('id', comentarios_ids)
      .andWhere({ estado: 'pendiente' });

    if (comentarios.length === 0) {
      return res.status(400).json({ error: 'No se encontraron comentarios pendientes con los IDs especificados' });
    }

    const wsId = comentarios[0].workspace_id || 1;
    const token = await getRedmineToken(wsId);
    const url = await getRedmineUrl(wsId);

    if (!token || !url) {
      return res.status(400).json({ error: 'Redmine no configurado' });
    }

    const ticketIds = [...new Set(comentarios.map(c => c.ticket_redmine_id))];

    if (ticketIds.length > 1) {
      return res.status(400).json({ error: 'Todos los comentarios deben pertenecer al mismo ticket' });
    }

    const ticketRedmineId = ticketIds[0];
    const baseUrl = url.replace(/\/+$/, '');

    const response = await fetch(`${baseUrl}/issues/${ticketRedmineId}.json`, {
      method: 'PUT',
      headers: {
        'X-Redmine-API-Key': token,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ issue: { notes: mensaje.trim() } }),
    });

    if (!response.ok) {
      const errText = await response.text();
      await db('redmine_comentarios')
        .whereIn('id', comentarios_ids)
        .update({ estado: 'error', updated_at: db.fn.now() });
      console.log('Error al enviar comentario a Redmine:', errText.slice(0, 300));
      return res.status(500).json({ error: 'Error al enviar comentario a Redmine: ' + errText.slice(0, 300) });
    }

    await db('redmine_comentarios')
      .whereIn('id', comentarios_ids)
      .update({ estado: 'enviado', updated_at: db.fn.now() });

    res.json({ success: true, ticket_id: ticketRedmineId, cantidad: comentarios.length });
  } catch (err) {
    console.log('Error al enviar comentarios Redmine:', err.message);
    res.status(500).json({ error: err.message });
  }
});

router.delete('/comments/sent', async (req, res) => {
  if (!authGuard(req, res)) return;

  try {
    const { sessionId } = req.body;
    if (!sessionId) {
      return res.status(400).json({ error: 'sessionId es requerido' });
    }

    const wsIds = req.session.workspaceIds || [];

    const deletedCount = await db('redmine_comentarios')
      .join('chat_sessions', 'redmine_comentarios.session_id', 'chat_sessions.id')
      .where('redmine_comentarios.session_id', sessionId)
      .where('redmine_comentarios.estado', 'enviado')
      .whereIn('chat_sessions.workspace_id', wsIds.length > 0 ? wsIds : [0])
      .del();

    res.json({ success: true, deletedCount });
  } catch (err) {
    console.log('Error al eliminar comentarios enviados:', err.message);
    res.status(500).json({ error: err.message });
  }
});

router.delete('/comments/:id', async (req, res) => {
  if (!authGuard(req, res)) return;

  try {
    const comment = await db('redmine_comentarios').where({ id: req.params.id }).first();
    if (!comment) {
      return res.status(404).json({ error: 'Comentario no encontrado' });
    }

    const wsIds = req.session.workspaceIds || [];
    if (wsIds.length > 0 && !wsIds.includes(comment.workspace_id)) {
      return res.status(403).json({ error: 'Acceso denegado al comentario' });
    }

    await db('redmine_comentarios').where({ id: req.params.id }).del();
    res.json({ success: true });
  } catch (err) {
    console.log('Error al eliminar comentario:', err.message);
    res.status(500).json({ error: err.message });
  }
});

export default router;
