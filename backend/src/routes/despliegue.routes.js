import express from 'express';
import fs from 'fs';
import path from 'path';
import db from '../config/db.js';
import sessionAuth from '../middlewares/sessionAuth.js';

const router = express.Router();

router.use(sessionAuth);

router.post('/upd-config', async (req, res) => {
  try {
    const { sessionId } = req.body;

    if (!sessionId) {
      return res.status(400).json({ success: false, error: 'Se requiere sessionId.' });
    }

    const session = await db('chat_sessions')
      .where({ id: sessionId, user_id: req.session.userId })
      .select('proyecto_id', 'cwd')
      .first();

    if (!session || !session.proyecto_id) {
      return res.status(400).json({
        success: false,
        error: 'La sesión de chat no está vinculada a un proyecto. Use /proyecto_set para seleccionar un proyecto.',
      });
    }

    const projectDir = session.cwd || process.cwd();
    const deployPath = path.resolve(projectDir, 'deploy.json');

    if (!fs.existsSync(deployPath)) {
      return res.status(404).json({
        success: false,
        error: `No se pudo obtener configuración de despliegue: falta el archivo "deploy.json". Se esperaba en: ${deployPath}`,
      });
    }

    let deployConfig;
    try {
      const raw = fs.readFileSync(deployPath, 'utf-8');
      deployConfig = JSON.parse(raw);
    } catch (err) {
      return res.status(400).json({
        success: false,
        error: `El archivo deploy.json no contiene JSON válido: ${err.message}`,
      });
    }

    await db('proyectos')
      .where({ id: session.proyecto_id })
      .update({ despliegue_config: JSON.stringify(deployConfig) });

    res.json({ success: true, message: 'Configuración de despliegue guardada correctamente.' });
  } catch (err) {
    console.log('Error en POST /api/despliegue/upd-config:', err);
    res.status(500).json({ success: false, error: 'Error al actualizar configuración de despliegue.' });
  }
});

router.get('/config', async (req, res) => {
  try {
    const { sessionId } = req.query;

    if (!sessionId) {
      return res.status(400).json({ success: false, error: 'Se requiere sessionId.' });
    }

    const session = await db('chat_sessions')
      .where({ id: sessionId, user_id: req.session.userId })
      .select('proyecto_id')
      .first();

    if (!session || !session.proyecto_id) {
      return res.status(400).json({
        success: false,
        error: 'La sesión de chat no está vinculada a un proyecto. Use /proyecto_set para seleccionar un proyecto.',
      });
    }

    const proyecto = await db('proyectos')
      .where({ id: session.proyecto_id })
      .select('despliegue_config')
      .first();

    if (!proyecto || !proyecto.despliegue_config) {
      return res.status(404).json({
        success: false,
        error: 'No hay configuración de despliegue guardada. Use /despliegue_upd_config para cargarla.',
      });
    }

    let config;
    try {
      config = JSON.parse(proyecto.despliegue_config);
    } catch (err) {
      config = proyecto.despliegue_config;
    }

    res.json({ success: true, config });
  } catch (err) {
    console.log('Error en GET /api/despliegue/config:', err);
    res.status(500).json({ success: false, error: 'Error al obtener configuración de despliegue.' });
  }
});

export default router;
