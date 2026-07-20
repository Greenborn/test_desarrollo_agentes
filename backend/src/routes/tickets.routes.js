import { Router } from 'express';
import db from '../config/db.js';
import { getRedmineToken, getRedmineUrl } from '../services/redmine.js';

const router = Router();

function authGuard(req, res) {
  if (!req.session?.userId) {
    res.status(401).json({ error: 'Sesión no válida' });
    return false;
  }
  return true;
}

router.get('/', async (req, res) => {
  if (!authGuard(req, res)) return;

  try {
    const wsIds = req.session.workspaceIds || [1];
    let query = db('tickets').whereIn('workspace_id', wsIds);

    if (req.query.proyecto_id) {
      query = query.where({ proyecto_id: req.query.proyecto_id });
    }

    const tickets = await query
      .select('*')
      .orderBy('redmine_updated_on', 'desc');

    res.json({ success: true, tickets });
  } catch (err) {
    console.log('Error al listar tickets:', err.message);
    res.status(500).json({ error: err.message });
  }
});

router.get('/options', async (req, res) => {
  if (!authGuard(req, res)) return;

  try {
    const wsIds = req.session.workspaceIds || [1];
    const wsId = wsIds[0] || 1;
    const token = await getRedmineToken(wsId);
    const url = await getRedmineUrl(wsId);

    if (!token || !url) {
      return res.json({ statuses: [], priorities: [], trackers: [], users: [] });
    }

    const baseUrl = url.replace(/\/+$/, '');

    const [statusesRes, prioritiesRes, trackersRes, usersRes] = await Promise.all([
      fetch(baseUrl + '/issue_statuses.json', {
        headers: { 'X-Redmine-API-Key': token, 'Content-Type': 'application/json' },
      }),
      fetch(baseUrl + '/enumerations/issue_priorities.json', {
        headers: { 'X-Redmine-API-Key': token, 'Content-Type': 'application/json' },
      }),
      fetch(baseUrl + '/trackers.json', {
        headers: { 'X-Redmine-API-Key': token, 'Content-Type': 'application/json' },
      }),
      fetch(baseUrl + '/users.json?limit=100&status=1', {
        headers: { 'X-Redmine-API-Key': token, 'Content-Type': 'application/json' },
      }),
    ]);

    const [statusesData, prioritiesData, trackersData, usersData] = await Promise.all([
      statusesRes.json(),
      prioritiesRes.json(),
      trackersRes.json(),
      usersRes.json(),
    ]);

    res.json({
      statuses: (statusesData.issue_statuses || []).map(s => ({ id: s.id, name: s.name })),
      priorities: (prioritiesData.issue_priorities || []).map(p => ({ id: p.id, name: p.name })),
      trackers: (trackersData.trackers || []).map(t => ({ id: t.id, name: t.name })),
      users: (usersData.users || []).map(u => ({
        id: u.id,
        name: [u.firstname, u.lastname].filter(Boolean).join(' '),
        login: u.login,
      })),
    });
  } catch (err) {
    console.log('Error al obtener opciones de Redmine:', err.message);
    res.json({ statuses: [], priorities: [], users: [] });
  }
});

router.get('/session/:sessionId', async (req, res) => {
  if (!authGuard(req, res)) return;

  try {
    const session = await db('chat_sessions')
      .select('id_ticket_redmine', 'proyecto_id')
      .where({ id: req.params.sessionId, user_id: req.session.userId })
      .first();

    const idTicketRedmine = session?.id_ticket_redmine || null;
    const proyectoId = session?.proyecto_id || null;
    let ticket = null;
    let comments = null;

    if (idTicketRedmine) {
      ticket = await db('tickets')
        .where({ redmine_id: idTicketRedmine })
        .first();
    }

    let attachments = null;

    if (idTicketRedmine) {
      try {
        const localTicket = await db('tickets').where({ redmine_id: idTicketRedmine }).select('workspace_id').first();
        const wsId = (localTicket && localTicket.workspace_id) || (req.session.workspaceIds || [1])[0] || 1;
        const token = await getRedmineToken(wsId);
        const url = await getRedmineUrl(wsId);
        if (token && url) {
          const apiUrl = url.replace(/\/+$/, '') + `/issues/${idTicketRedmine}.json?include=attachments`;
          const response = await fetch(apiUrl, {
            headers: {
              'X-Redmine-API-Key': token,
              'Content-Type': 'application/json',
            },
          });
          const data = await response.json();
          if (data.issue?.attachments) {
            attachments = data.issue.attachments.map(a => ({
              id: a.id,
              filename: a.filename,
              content_type: a.content_type,
              content_url: a.content_url,
              description: a.description || '',
              filesize: a.filesize,
              created_on: a.created_on,
            }));
          }
        }
      } catch (e) {
        console.log('Error al obtener attachments de Redmine:', e.message);
        attachments = [];
      }
    }

    if (idTicketRedmine && req.query.comments === 'true') {
      try {
        const localTicket = await db('tickets').where({ redmine_id: idTicketRedmine }).select('workspace_id').first();
        const wsId = (localTicket && localTicket.workspace_id) || (req.session.workspaceIds || [1])[0] || 1;
        const token = await getRedmineToken(wsId);
        const url = await getRedmineUrl(wsId);
        if (token && url) {
          const apiUrl = url.replace(/\/+$/, '') + `/issues/${idTicketRedmine}.json?include=journals`;
          const response = await fetch(apiUrl, {
            headers: {
              'X-Redmine-API-Key': token,
              'Content-Type': 'application/json',
            },
          });
          const data = await response.json();
          if (data.issue?.journals) {
            comments = data.issue.journals
              .filter(j => j.notes && j.notes.trim())
              .map(j => ({
                user: j.user?.name || '—',
                notes: j.notes,
                created_on: j.created_on,
              }));
          }
        }
      } catch (e) {
        console.log('Error al obtener comentarios de Redmine:', e.message);
        comments = [];
      }
    }

    res.json({ idTicketRedmine, proyectoId, ticket, comments, attachments });
  } catch (err) {
    console.log('Error al obtener ticket de sesión:', err.message);
    res.status(500).json({ error: err.message });
  }
});

router.post('/session', async (req, res) => {
  if (!authGuard(req, res)) return;

  const { sessionId, idTicketRedmine } = req.body;

  if (!sessionId) {
    return res.status(400).json({ error: 'sessionId es requerido' });
  }

  try {
    const updateData = { id_ticket_redmine: idTicketRedmine || null, updated_at: db.fn.now() };

    if (idTicketRedmine) {
      let targetWsId = null;

      const ticket = await db('tickets')
        .where({ redmine_id: idTicketRedmine })
        .select('workspace_id', 'proyecto_id')
        .first();

      if (ticket?.workspace_id) {
        targetWsId = ticket.workspace_id;
      } else {
        const session = await db('chat_sessions')
          .where({ id: sessionId, user_id: req.session.userId })
          .select('proyecto_id')
          .first();

        if (session?.proyecto_id) {
          const proyecto = await db('proyectos')
            .where({ id: session.proyecto_id })
            .select('workspace_id')
            .first();

          if (proyecto?.workspace_id) {
            targetWsId = proyecto.workspace_id;
          }
        }
      }

      if (targetWsId) {
        updateData.workspace_id = targetWsId;

        const oldIds = req.session.workspaceIds || [1];
        if (!oldIds.includes(targetWsId)) {
          const newIds = [...oldIds, targetWsId];
          req.session.workspaceIds = newIds;
          await new Promise(resolve => req.session.save(resolve));

          await db('user_settings')
            .insert({ user_id: req.session.userId, key: 'selected_workspace_id', value: JSON.stringify(newIds) })
            .onConflict(['user_id', 'key'])
            .merge();
        }
      }
    }

    await db('chat_sessions')
      .where({ id: sessionId, user_id: req.session.userId })
      .update(updateData);

    res.json({ success: true, workspaceIds: req.session.workspaceIds || [1] });
  } catch (err) {
    console.log('Error al asignar ticket a sesión:', err.message);
    res.status(500).json({ error: err.message });
  }
});

router.get('/ticket-options/:ticketId', async (req, res) => {
  if (!authGuard(req, res)) return;

  try {
    const wsIds = req.session.workspaceIds || [1];
    const wsId = wsIds[0] || 1;
    const token = await getRedmineToken(wsId);
    const url = await getRedmineUrl(wsId);

    if (!token || !url) {
      return res.json({ statuses: [], priorities: [], users: [] });
    }

    const baseUrl = url.replace(/\/+$/, '');

    const issueRes = await fetch(`${baseUrl}/issues/${req.params.ticketId}.json?include=allowed_statuses`, {
      headers: { 'X-Redmine-API-Key': token, 'Content-Type': 'application/json' },
    });

    let allowedStatuses = [];
    let projectId = null;
    if (issueRes.ok) {
      const issueData = await issueRes.json();
      allowedStatuses = issueData.issue?.allowed_statuses || [];
      projectId = issueData.issue?.project?.id;
    } else {
      console.log(`Error HTTP ${issueRes.status} al obtener datos del ticket ${req.params.ticketId}`);
    }

    const [prioritiesRes, usersRes] = await Promise.all([
      fetch(baseUrl + '/enumerations/issue_priorities.json', {
        headers: { 'X-Redmine-API-Key': token, 'Content-Type': 'application/json' },
      }),
      projectId
        ? fetch(`${baseUrl}/projects/${projectId}/memberships.json`, {
            headers: { 'X-Redmine-API-Key': token, 'Content-Type': 'application/json' },
          })
        : fetch(baseUrl + '/users.json?limit=100&status=1', {
            headers: { 'X-Redmine-API-Key': token, 'Content-Type': 'application/json' },
          }),
    ]);

    const prioritiesData = prioritiesRes.ok ? await prioritiesRes.json() : { issue_priorities: [] };
    const usersData = usersRes.ok ? await usersRes.json() : {};

    const memberships = usersData.memberships || [];
    const allUsers = usersData.users || [];

    let users;
    if (memberships.length > 0) {
      users = memberships
        .filter(m => m.user)
        .map(m => ({
          id: m.user.id,
          name: m.user.name,
        }));
    } else {
      users = allUsers.map(u => ({
        id: u.id,
        name: [u.firstname, u.lastname].filter(Boolean).join(' '),
        login: u.login,
      }));
    }

    res.json({
      statuses: (allowedStatuses || []).map(s => ({ id: s.id, name: s.name })),
      priorities: (prioritiesData.issue_priorities || []).map(p => ({ id: p.id, name: p.name })),
      users,
    });
  } catch (err) {
    console.log('Error al obtener opciones del ticket en Redmine:', err.message);
    res.json({ statuses: [], priorities: [], users: [] });
  }
});

router.get('/statuses/:ticketId', async (req, res) => {
  if (!authGuard(req, res)) return;

  try {
    const wsIds = req.session.workspaceIds || [1];
    const wsId = wsIds[0] || 1;
    const token = await getRedmineToken(wsId);
    const url = await getRedmineUrl(wsId);

    if (!token || !url) {
      return res.json({ statuses: [] });
    }

    const baseUrl = url.replace(/\/+$/, '');
    const response = await fetch(`${baseUrl}/issues/${req.params.ticketId}.json?include=allowed_statuses`, {
      headers: { 'X-Redmine-API-Key': token, 'Content-Type': 'application/json' },
    });

    if (!response.ok) {
      console.log(`Error HTTP ${response.status} al obtener estados permitidos del ticket ${req.params.ticketId}`);
      return res.json({ statuses: [] });
    }

    const data = await response.json();
    const allowedStatuses = data.issue?.allowed_statuses || [];

    res.json({
      statuses: allowedStatuses.map(s => ({ id: s.id, name: s.name })),
    });
  } catch (err) {
    console.log('Error al obtener estados permitidos de Redmine:', err.message);
    res.json({ statuses: [] });
  }
});

router.get('/project-members/:projectId', async (req, res) => {
  if (!authGuard(req, res)) return;

  try {
    const wsIds = req.session.workspaceIds || [1];
    const proyecto = await db('proyectos')
      .select('redmine_id', 'workspace_id')
      .where({ id: req.params.projectId })
      .whereIn('workspace_id', wsIds)
      .first();

    if (!proyecto) {
      return res.json({ users: [] });
    }

    const wsId = (proyecto && proyecto.workspace_id) || wsIds[0] || 1;
    const token = await getRedmineToken(wsId);
    const url = await getRedmineUrl(wsId);
    if (!token || !url) {
      return res.json({ users: [] });
    }

    const baseUrl = url.replace(/\/+$/, '');

    const membersRes = await fetch(`${baseUrl}/projects/${proyecto.redmine_id}/memberships.json`, {
      headers: { 'X-Redmine-API-Key': token, 'Content-Type': 'application/json' },
    });

    if (!membersRes.ok) {
      console.log(`Error HTTP ${membersRes.status} al obtener memberships del proyecto ${req.params.projectId}`);
      return res.json({ users: [] });
    }

    const membersData = await membersRes.json();
    const memberships = membersData.memberships || [];

    const users = memberships
      .filter(m => m.user)
      .map(m => ({
        id: m.user.id,
        name: m.user.name,
      }));

    res.json({ users });
  } catch (err) {
    console.log('Error al obtener miembros del proyecto:', err.message);
    res.json({ users: [] });
  }
});

router.get('/project-trackers/:projectId', async (req, res) => {
  if (!authGuard(req, res)) return;

  try {
    const wsIds = req.session.workspaceIds || [1];
    const proyecto = await db('proyectos')
      .select('redmine_id', 'workspace_id')
      .where({ id: req.params.projectId })
      .whereIn('workspace_id', wsIds)
      .first();

    if (!proyecto || !proyecto.redmine_id) {
      return res.json({ trackers: [] });
    }

    const wsId = (proyecto && proyecto.workspace_id) || wsIds[0] || 1;
    const token = await getRedmineToken(wsId);
    const url = await getRedmineUrl(wsId);
    if (!token || !url) {
      return res.json({ trackers: [] });
    }

    const baseUrl = url.replace(/\/+$/, '');
    const projRes = await fetch(`${baseUrl}/projects/${proyecto.redmine_id}.json?include=trackers`, {
      headers: { 'X-Redmine-API-Key': token, 'Content-Type': 'application/json' },
    });

    if (!projRes.ok) {
      console.log(`Error HTTP ${projRes.status} al obtener trackers del proyecto ${req.params.projectId}`);
      return res.json({ trackers: [] });
    }

    const projData = await projRes.json();
    const trackers = (projData.project?.trackers || []).map(t => ({ id: t.id, name: t.name }));

    res.json({ trackers });
  } catch (err) {
    console.log('Error al obtener trackers del proyecto:', err.message);
    res.json({ trackers: [] });
  }
});

router.post('/create', async (req, res) => {
  if (!authGuard(req, res)) return;

  const { subject, description, project_id, status_name, status_id, priority_name, priority_id, tracker_name, tracker_id, assigned_to_name, assigned_to_id, done_ratio } = req.body;

  if (!subject || !subject.trim()) {
    return res.status(400).json({ error: 'El asunto es requerido.' });
  }

  if (!project_id) {
    return res.status(400).json({ error: 'El proyecto es requerido.' });
  }

  if (done_ratio !== undefined && (done_ratio < 0 || done_ratio > 100)) {
    return res.status(400).json({ error: 'El porcentaje de avance debe estar entre 0 y 100.' });
  }

  try {
    const wsIds = req.session.workspaceIds || [1];

    const proyecto = await db('proyectos')
      .select('redmine_id', 'workspace_id')
      .where({ id: project_id })
      .whereIn('workspace_id', wsIds)
      .first();

    if (!proyecto) {
      return res.status(400).json({ error: 'Proyecto no encontrado.' });
    }

    const wsId = (proyecto && proyecto.workspace_id) || wsIds[0] || 1;
    const token = await getRedmineToken(wsId);
    const url = await getRedmineUrl(wsId);

    if (!token || !url) {
      return res.status(400).json({ error: 'Redmine no configurado. Configure la URL y el token en Settings.' });
    }

    const baseUrl = url.replace(/\/+$/, '');

    const redminePayload = {
      project_id: proyecto.redmine_id,
      subject: subject.trim(),
    };

    if (description) redminePayload.description = description;
    if (status_id != null) redminePayload.status_id = status_id;
    if (assigned_to_id != null) redminePayload.assigned_to_id = assigned_to_id;
    if (done_ratio !== undefined) redminePayload.done_ratio = done_ratio;

    if (priority_id != null) {
      redminePayload.priority_id = priority_id;
    } else if (priority_name) {
      try {
        const priRes = await fetch(baseUrl + '/enumerations/issue_priorities.json', {
          headers: { 'X-Redmine-API-Key': token, 'Content-Type': 'application/json' },
        });
        if (priRes.ok) {
          const priData = await priRes.json();
          const match = (priData.issue_priorities || []).find(p => p.name === priority_name);
          if (match) redminePayload.priority_id = match.id;
        }
      } catch (e) {
        console.log('Error al resolver priority_id desde Redmine:', e.message);
      }
    }

    if (tracker_id != null) {
      redminePayload.tracker_id = tracker_id;
    } else if (tracker_name) {
      try {
        const trkRes = await fetch(baseUrl + '/trackers.json', {
          headers: { 'X-Redmine-API-Key': token, 'Content-Type': 'application/json' },
        });
        if (trkRes.ok) {
          const trkData = await trkRes.json();
          const match = (trkData.trackers || []).find(t => t.name === tracker_name);
          if (match) redminePayload.tracker_id = match.id;
        }
      } catch (e) {
        console.log('Error al resolver tracker_id desde Redmine:', e.message);
      }
    }

    const redmineRes = await fetch(baseUrl + '/issues.json', {
      method: 'POST',
      headers: {
        'X-Redmine-API-Key': token,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ issue: redminePayload }),
    });

    if (!redmineRes.ok) {
      const errText = await redmineRes.text();
      console.log('Error al crear ticket en Redmine:', errText);
      return res.status(500).json({ error: 'Error al crear ticket en Redmine: ' + (errText.slice(0, 300)) });
    }

    const redmineData = await redmineRes.json();
    const redmineId = redmineData.issue?.id;

    if (!redmineId) {
      return res.status(500).json({ error: 'No se pudo obtener el ID del ticket creado en Redmine.' });
    }

    const createdIssue = redmineData.issue;

    const insertData = {
      workspace_id: wsId,
      proyecto_id: project_id,
      redmine_id: redmineId,
      subject: createdIssue.subject || subject.trim(),
      description: createdIssue.description || description || null,
      status_name: createdIssue.status?.name || status_name || null,
      tracker_name: createdIssue.tracker?.name || null,
      priority_id: createdIssue.priority?.id || priority_id || null,
      priority_name: createdIssue.priority?.name || priority_name || null,
      assigned_to_name: createdIssue.assigned_to?.name || assigned_to_name || null,
      author_name: createdIssue.author?.name || null,
      start_date: createdIssue.start_date || null,
      due_date: createdIssue.due_date || null,
      estimated_hours: createdIssue.estimated_hours || null,
      done_ratio: createdIssue.done_ratio ?? done_ratio ?? null,
      redmine_created_on: createdIssue.created_on ? createdIssue.created_on.replace('Z', '') : null,
      redmine_updated_on: createdIssue.updated_on ? createdIssue.updated_on.replace('Z', '') : null,
    };

    const [insertedId] = await db('tickets').insert(insertData);

    const created = await db('tickets').where({ id: insertedId }).first();

    res.json({ success: true, ticket: created });
  } catch (err) {
    console.log('Error al crear ticket:', err.message);
    res.status(500).json({ error: err.message });
  }
});

router.put('/session/:sessionId', async (req, res) => {
  if (!authGuard(req, res)) return;

  const { subject, description, status_name, priority_name, assigned_to_name, status_id, priority_id, assigned_to_id, notes, done_ratio } = req.body;

  if (subject !== undefined && subject.trim().length === 0) {
    return res.status(400).json({ error: 'El asunto no puede estar vacío.' });
  }

  if (done_ratio !== undefined && (done_ratio < 0 || done_ratio > 100)) {
    return res.status(400).json({ error: 'El porcentaje de avance debe estar entre 0 y 100.' });
  }

  try {
    const session = await db('chat_sessions')
      .select('id_ticket_redmine')
      .where({ id: req.params.sessionId, user_id: req.session.userId })
      .first();

    const idTicketRedmine = session?.id_ticket_redmine;
    if (!idTicketRedmine) {
      return res.status(400).json({ error: 'No hay ticket asignado a esta sesión.' });
    }

    const localUpdate = {};
    const redmineUpdate = {};

    if (subject !== undefined) { localUpdate.subject = subject.trim(); redmineUpdate.subject = subject.trim(); }
    if (description !== undefined) { localUpdate.description = description; redmineUpdate.description = description; }
    if (status_name !== undefined) { localUpdate.status_name = status_name.trim(); }
    if (priority_name !== undefined) { localUpdate.priority_name = priority_name.trim(); }
    if (priority_id != null) { localUpdate.priority_id = priority_id; }
    if (assigned_to_name !== undefined) { localUpdate.assigned_to_name = assigned_to_name.trim(); }
    if (done_ratio !== undefined) { localUpdate.done_ratio = done_ratio; redmineUpdate.done_ratio = done_ratio; }
    if (status_id != null) { redmineUpdate.status_id = status_id; }
    if (priority_id != null) { redmineUpdate.priority_id = priority_id; }
    if (assigned_to_id != null) { redmineUpdate.assigned_to_id = assigned_to_id; }
    if (notes !== undefined && notes.trim()) { redmineUpdate.notes = notes.trim(); }

    if (Object.keys(localUpdate).length > 0) {
      await db('tickets')
        .where({ redmine_id: idTicketRedmine })
        .update(localUpdate);
    }

    if (Object.keys(redmineUpdate).length > 0) {
      try {
        const localTicket = await db('tickets').where({ redmine_id: idTicketRedmine }).select('workspace_id').first();
        const wsId = (localTicket && localTicket.workspace_id) || (req.session.workspaceIds || [1])[0] || 1;
        const token = await getRedmineToken(wsId);
        const url = await getRedmineUrl(wsId);
        if (token && url) {
          const apiUrl = url.replace(/\/+$/, '') + `/issues/${idTicketRedmine}.json`;
          const response = await fetch(apiUrl, {
            method: 'PUT',
            headers: {
              'X-Redmine-API-Key': token,
              'Content-Type': 'application/json',
            },
            body: JSON.stringify({ issue: redmineUpdate }),
          });
          if (!response.ok) {
            const errText = await response.text();
            console.log('Error al actualizar en Redmine:', errText);
          }
        }
      } catch (e) {
        console.log('Error al conectar con Redmine para actualizar:', e.message);
      }
    }

    const updated = await db('tickets')
      .where({ redmine_id: idTicketRedmine })
      .first();

    res.json({ success: true, ticket: updated });
  } catch (err) {
    console.log('Error al actualizar ticket:', err.message);
    res.status(500).json({ error: err.message });
  }
});

router.get('/attachments/by-ticket/:redmineId', async (req, res) => {
  if (!authGuard(req, res)) return;

  try {
    const localTicket = await db('tickets').where({ redmine_id: req.params.redmineId }).select('workspace_id').first();
    const wsId = (localTicket && localTicket.workspace_id) || (req.session.workspaceIds || [1])[0] || 1;
    const token = await getRedmineToken(wsId);
    const url = await getRedmineUrl(wsId);

    if (!token || !url) {
      return res.json({ attachments: [] });
    }

    const apiUrl = url.replace(/\/+$/, '') + `/issues/${req.params.redmineId}.json?include=attachments`;
    const response = await fetch(apiUrl, {
      headers: {
        'X-Redmine-API-Key': token,
        'Content-Type': 'application/json',
      },
    });

    if (!response.ok) {
      console.log(`Error HTTP ${response.status} al obtener attachments del ticket ${req.params.redmineId}`);
      return res.json({ attachments: [] });
    }

    const data = await response.json();
    const attachments = (data.issue?.attachments || []).map(a => ({
      id: a.id,
      filename: a.filename,
      content_type: a.content_type,
      content_url: a.content_url,
      description: a.description || '',
      filesize: a.filesize,
      created_on: a.created_on,
    }));

    res.json({ attachments });
  } catch (err) {
    console.log('Error al obtener attachments del ticket:', err.message);
    res.json({ attachments: [] });
  }
});

router.get('/attachments/:attachmentId/download', async (req, res) => {
  if (!authGuard(req, res)) return;

  try {
    const wsIds = req.session.workspaceIds || [1];
    const wsId = wsIds[0] || 1;
    const token = await getRedmineToken(wsId);
    const url = await getRedmineUrl(wsId);

    if (!token || !url) {
      return res.status(404).json({ error: 'Redmine no configurado' });
    }

    const baseUrl = url.replace(/\/+$/, '');
    const redmineRes = await fetch(`${baseUrl}/attachments/download/${req.params.attachmentId}`, {
      headers: { 'X-Redmine-API-Key': token },
    });

    if (!redmineRes.ok) {
      const text = await redmineRes.text();
      console.log(`Error HTTP ${redmineRes.status} al descargar attachment ${req.params.attachmentId}: ${text.slice(0, 200)}`);
      return res.status(redmineRes.status).json({ error: 'Error al descargar el archivo desde Redmine' });
    }

    const contentType = redmineRes.headers.get('content-type');
    const contentDisposition = redmineRes.headers.get('content-disposition');
    if (contentType) res.setHeader('Content-Type', contentType);
    if (contentDisposition) res.setHeader('Content-Disposition', contentDisposition);

    redmineRes.body.pipe(res);
  } catch (err) {
    console.log('Error al descargar attachment:', err.message);
    res.status(500).json({ error: err.message });
  }
});

export default router;
