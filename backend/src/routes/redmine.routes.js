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
    const token = await getRedmineToken();
    const url = await getRedmineUrl();

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
    const token = await getRedmineToken();
    const url = await getRedmineUrl();

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
    const token = await getRedmineToken();
    const url = await getRedmineUrl();

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
        if (existing) {
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
    const existing = await db('proyectos').where({ id: proyectoId }).first();
    if (existing) {
      res.json({ success: false, message: `El proyecto "${name}" ya existe en la base de local.` });
      return;
    }

    await db('proyectos').insert({
      id: proyectoId,
      descripcion: description || '',
      redmine_id: id,
      redmine_status: status || null,
      redmine_created_on: toDateTime(created_on),
      redmine_updated_on: toDateTime(updated_on),
      redmine_parent_id: parent?.id ? String(parent.id) : null,
      redmine_parent_name: parent?.name || null,
    });

    res.json({ success: true, proyectoId });
  } catch (err) {
    console.log('Error al importar proyecto Redmine:', err.message);
    res.json({ success: false, message: 'Error al importar proyecto: ' + err.message });
  }
});

router.get('/proyectos/:proyectoId/tickets', async (req, res) => {
  if (!authGuard(req, res)) return;

  try {
    const proyecto = await db('proyectos').where({ id: req.params.proyectoId }).first();

    if (!proyecto) {
      res.json({ success: false, message: `Proyecto "${req.params.proyectoId}" no encontrado en la base local.` });
      return;
    }

    if (!proyecto.redmine_id) {
      res.json({ success: false, message: `El proyecto "${req.params.proyectoId}" no tiene ID de Redmine asociado.` });
      return;
    }

    const token = await getRedmineToken();
    const url = await getRedmineUrl();

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

export default router;
