import { Router } from 'express';
import db from '../config/db.js';

const router = Router();

function authGuard(req, res) {
  if (!req.session?.userId) {
    res.status(401).json({ error: 'Sesión no válida' });
    return false;
  }
  return true;
}

const DOC_BASE = () => `http://localhost:${process.env.SERVICIO_DOCUMENTAL_PORT || 4099}/api/documentacion`;

router.get('/:proyectoId', async (req, res) => {
  if (!authGuard(req, res)) return;
  try {
    const response = await fetch(`${DOC_BASE()}/${req.params.proyectoId}`);
    const data = await response.json();
    res.json(data);
  } catch (err) {
    console.log('Error al obtener documentación:', err.message);
    res.status(500).json({ error: err.message });
  }
});

router.get('/escaneo/ultimo/:sessionId', async (req, res) => {
  if (!authGuard(req, res)) return;
  try {
    const response = await fetch(`${DOC_BASE()}/escaneo/ultimo/${req.params.sessionId}`);
    const data = await response.json();
    res.json(data);
  } catch (err) {
    console.log('Error al obtener último escaneo:', err.message);
    res.status(500).json({ error: err.message });
  }
});

router.post('/escaneo/iniciar', async (req, res) => {
  if (!authGuard(req, res)) return;
  try {
    const response = await fetch(`${DOC_BASE()}/escaneo/iniciar`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(req.body),
    });
    const data = await response.json();
    res.status(response.status).json(data);
  } catch (err) {
    console.log('Error al iniciar escaneo:', err.message);
    res.status(500).json({ error: err.message });
  }
});

router.put('/escaneo/:id/finalizar', async (req, res) => {
  if (!authGuard(req, res)) return;
  try {
    const response = await fetch(`${DOC_BASE()}/escaneo/${req.params.id}/finalizar`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(req.body),
    });
    const data = await response.json();
    res.json(data);
  } catch (err) {
    console.log('Error al finalizar escaneo:', err.message);
    res.status(500).json({ error: err.message });
  }
});

router.post('/archivo', async (req, res) => {
  if (!authGuard(req, res)) return;
  try {
    const response = await fetch(`${DOC_BASE()}/archivo`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(req.body),
    });
    const data = await response.json();
    res.status(response.status).json(data);
  } catch (err) {
    console.log('Error al guardar archivo:', err.message);
    res.status(500).json({ error: err.message });
  }
});

router.delete('/archivo/por-escaneo/:escaneoId', async (req, res) => {
  if (!authGuard(req, res)) return;
  try {
    const response = await fetch(`${DOC_BASE()}/archivo/por-escaneo/${req.params.escaneoId}`, { method: 'DELETE' });
    const data = await response.json();
    res.json(data);
  } catch (err) {
    console.log('Error al limpiar archivos del escaneo:', err.message);
    res.status(500).json({ error: err.message });
  }
});

router.post('/archivo/batch', async (req, res) => {
  if (!authGuard(req, res)) return;
  try {
    const response = await fetch(`${DOC_BASE()}/archivo/batch`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(req.body),
    });
    const data = await response.json();
    res.status(response.status).json(data);
  } catch (err) {
    console.log('Error al guardar batch de archivos:', err.message);
    res.status(500).json({ error: err.message });
  }
});

const TABLA_MAP = {
  base_datos: 'documentacion_base_datos',
  subproyectos: 'documentacion_subproyectos',
  endpoints: 'documentacion_endpoints',
  web_sockets: 'documentacion_web_sockets',
  funcionalidades: 'documentacion_funcionalidades',
};

// ------------------------------------------------
// NOTAS (key-value documentation)
// ------------------------------------------------

router.get('/notas/:proyectoId', async (req, res) => {
  if (!authGuard(req, res)) return;
  try {
    const response = await fetch(`${DOC_BASE()}/notas/${req.params.proyectoId}`);
    const data = await response.json();
    res.json(data);
  } catch (err) {
    console.log('Error al listar notas:', err.message);
    res.status(500).json({ error: err.message });
  }
});

router.get('/notas/:proyectoId/:clave', async (req, res) => {
  if (!authGuard(req, res)) return;
  try {
    const response = await fetch(`${DOC_BASE()}/notas/${req.params.proyectoId}/${encodeURIComponent(req.params.clave)}`);
    const data = await response.json();
    res.status(response.status).json(data);
  } catch (err) {
    console.log('Error al obtener nota:', err.message);
    res.status(500).json({ error: err.message });
  }
});

router.post('/notas', async (req, res) => {
  if (!authGuard(req, res)) return;
  try {
    const response = await fetch(`${DOC_BASE()}/notas`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(req.body),
    });
    const data = await response.json();
    res.status(response.status).json(data);
  } catch (err) {
    console.log('Error al crear nota:', err.message);
    res.status(500).json({ error: err.message });
  }
});

router.put('/notas/:id', async (req, res) => {
  if (!authGuard(req, res)) return;
  try {
    const response = await fetch(`${DOC_BASE()}/notas/${req.params.id}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(req.body),
    });
    const data = await response.json();
    res.status(response.status).json(data);
  } catch (err) {
    console.log('Error al actualizar nota:', err.message);
    res.status(500).json({ error: err.message });
  }
});

router.delete('/notas/:id', async (req, res) => {
  if (!authGuard(req, res)) return;
  try {
    const response = await fetch(`${DOC_BASE()}/notas/${req.params.id}`, { method: 'DELETE' });
    const data = await response.json();
    res.json(data);
  } catch (err) {
    console.log('Error al eliminar nota:', err.message);
    res.status(500).json({ error: err.message });
  }
});

router.put('/:tipo/:proyectoId', async (req, res) => {
  if (!authGuard(req, res)) return;
  try {
    const { tipo, proyectoId } = req.params;
    const { data } = req.body;

    const table = TABLA_MAP[tipo];
    if (!table) {
      return res.status(400).json({ error: `Tipo de documentación no válido: "${tipo}"` });
    }

    if (!data) {
      return res.status(400).json({ error: 'Campo "data" es requerido' });
    }

    await db(table).where({ id_proyecto: proyectoId }).del();
    await db(table).insert({
      id_proyecto: proyectoId,
      data: JSON.stringify({ respuesta: data, generado_por: 'opencode' }),
    });

    res.json({ success: true });
  } catch (err) {
    console.log(`Error al actualizar ${req.params.tipo}:`, err.message);
    res.status(500).json({ error: err.message });
  }
});

export default router;
