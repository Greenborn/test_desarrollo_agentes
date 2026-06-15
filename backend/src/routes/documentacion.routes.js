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

router.get('/:proyectoId', async (req, res) => {
  if (!authGuard(req, res)) return;
  try {
    const docPort = process.env.SERVICIO_DOCUMENTAL_PORT || 4099;
    const response = await fetch(`http://localhost:${docPort}/api/documentacion/${req.params.proyectoId}`);
    const data = await response.json();
    res.json(data);
  } catch (err) {
    console.log('Error al obtener documentación:', err.message);
    res.status(500).json({ error: err.message });
  }
});

router.put('/subproyectos/:proyectoId', async (req, res) => {
  if (!authGuard(req, res)) return;
  try {
    const { proyectoId } = req.params;
    const { data } = req.body;

    if (!data) {
      return res.status(400).json({ error: 'Campo "data" es requerido' });
    }

    await db('documentacion_subproyectos').where({ id_proyecto: proyectoId }).del();
    await db('documentacion_subproyectos').insert({
      id_proyecto: proyectoId,
      data: JSON.stringify({ respuesta: data, generado_por: 'opencode' }),
    });

    res.json({ success: true });
  } catch (err) {
    console.log('Error al actualizar subproyectos:', err.message);
    res.status(500).json({ error: err.message });
  }
});

export default router;
