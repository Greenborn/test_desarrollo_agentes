import db from '../config/db.js';
import { decrypt } from './crypto.js';

export async function getRedmineToken(workspaceId) {
  try {
    const row = await db('settings').where({ workspace_id: workspaceId || 1, setting_key: 'redmine_token' }).first();
    if (!row || !row.setting_value) return null;
    return decrypt(row.setting_value);
  } catch (err) {
    console.log('Error al obtener redmine_token:', err.message);
    return null;
  }
}

export async function getRedmineUrl(workspaceId) {
  try {
    const row = await db('settings').where({ workspace_id: workspaceId || 1, setting_key: 'redmine_url' }).first();
    return row ? row.setting_value : null;
  } catch (err) {
    console.log('Error al obtener redmine_url:', err.message);
    return null;
  }
}

function toDateTime(dateStr) {
  if (!dateStr) return null;
  const d = new Date(dateStr);
  if (isNaN(d.getTime())) return dateStr;
  return d.toISOString().replace('T', ' ').replace('Z', '').split('.')[0];
}

export async function syncRedmineTicket(redmineId, wsId, proyectoId) {
  const token = await getRedmineToken(wsId);
  const url = await getRedmineUrl(wsId);

  if (!token || !url) {
    return { found: false, error: 'Redmine no configurado para este workspace' };
  }

  const apiUrl = url.replace(/\/+$/, '') + `/issues/${redmineId}.json`;
  const response = await fetch(apiUrl, {
    headers: {
      'X-Redmine-API-Key': token,
      'Content-Type': 'application/json',
    },
  });

  if (response.status === 404) {
    return { found: false, error: `Ticket #${redmineId} no encontrado en Redmine` };
  }
  if (!response.ok) {
    const text = await response.text();
    return { found: false, error: `Error HTTP ${response.status} al consultar Redmine${text ? ' — ' + text.slice(0, 200) : ''}` };
  }

  const data = await response.json();
  const issue = data.issue;

  if (!proyectoId) {
    const redmineProjectId = issue.project?.id;
    if (redmineProjectId) {
      const localProyecto = await db('proyectos')
        .where({ redmine_id: redmineProjectId, workspace_id: wsId })
        .select('id')
        .first();
      if (localProyecto) {
        proyectoId = localProyecto.id;
      }
    }
  }

  if (!proyectoId) {
    return { found: false, error: 'No se pudo determinar el proyecto local para este ticket. Asigne un proyecto a la sesión primero.' };
  }

  const ticketData = {
    proyecto_id: proyectoId,
    workspace_id: wsId,
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
    if (existing.workspace_id !== ticketData.workspace_id) {
      await db('chat_sessions')
        .where({ id_ticket_redmine: issue.id })
        .update({ workspace_id: ticketData.workspace_id, updated_at: db.fn.now() });
    }
  } else {
    await db('tickets').insert(ticketData);
  }

  return { found: true, ticket: ticketData };
}
