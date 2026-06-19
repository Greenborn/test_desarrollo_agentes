import express from 'express';
import fs from 'fs';
import path from 'path';
import db from '../config/db.js';
import sessionAuth from '../middlewares/sessionAuth.js';
import * as devInstanceManager from '../services/devInstanceManager.js';
import playwrightManager from '../services/playwrightManager.js';

const PW_PORT = process.env.SERVICIO_PLAYWRIGHT_PORT || 4098;
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

router.post('/iniciar-instancia-dev', async (req, res) => {
  try {
    const { sessionId, resolution: customResolution } = req.body;

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

    const proyecto = await db('proyectos')
      .where({ id: session.proyecto_id })
      .select('despliegue_config')
      .first();

    if (!proyecto || !proyecto.despliegue_config) {
      return res.status(400).json({
        success: false,
        error: 'No hay configuración de despliegue guardada. Use /despliegue_upd_config para cargarla.',
      });
    }

    let deployConfig;
    try {
      deployConfig = JSON.parse(proyecto.despliegue_config);
    } catch (err) {
      return res.status(400).json({
        success: false,
        error: 'La configuración de despliegue guardada no es JSON válido.',
      });
    }

    const projectRoot = session.cwd || process.cwd();

    const results = await devInstanceManager.startDevInstance(projectRoot, deployConfig);

    const frontendPorts = await devInstanceManager.waitForFrontendPorts(20000);

    const browserSessions = [];

    if (frontendPorts.length > 0) {
      try {
        await playwrightManager.ensureRunning();

        let resolution = null;
        if (customResolution && customResolution.width && customResolution.height) {
          resolution = customResolution;
        } else {
          try {
            const defaultResRow = await db('user_settings')
              .select('value')
              .where({ user_id: req.session.userId, key: 'default_resolution' })
              .first();
            if (defaultResRow && defaultResRow.value) {
              const wsId = req.session.workspaceId || 1;
              const screenResRow = await db('settings')
                .select('setting_value')
                .where({ workspace_id: wsId, setting_key: 'screen_resolutions' })
                .first();
              if (screenResRow && screenResRow.setting_value) {
                const resolutions = JSON.parse(screenResRow.setting_value);
                const match = resolutions.find(r => r.id === defaultResRow.value);
                if (match && match.width && match.height) {
                  resolution = { id: match.id, width: match.width, height: match.height };
                }
              }
            }
          } catch (err) {
            console.log('[despliegue] Error al obtener resolución por defecto:', err.message);
          }
        }

        for (const fe of frontendPorts) {
          try {
            const parametros = { navegador: 'chrome', url: fe.url };
            if (resolution) parametros.resolution = resolution;

            const pwRes = await fetch(`http://localhost:${PW_PORT}/api/command`, {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({ comando: 'start', parametros }),
            });
            const pwData = await pwRes.json();
            if (pwData.id_session) {
              browserSessions.push({ name: fe.name, url: fe.url, idSession: pwData.id_session });
              devInstanceManager.registerBrowserSession({ name: fe.name, url: fe.url, idSession: pwData.id_session });
            } else if (pwData.error) {
              console.log(`[despliegue] Error al abrir navegador para ${fe.name}: ${pwData.error}`);
            }
          } catch (err) {
            console.log(`[despliegue] Error al conectar con playwright para ${fe.name}:`, err.message);
          }
        }
      } catch (err) {
        console.log('[despliegue] Error al iniciar servicio playwright:', err.message);
      }
    }

    res.json({ success: true, results, frontendPorts, browserSessions });
  } catch (err) {
    console.log('Error en POST /api/despliegue/iniciar-instancia-dev:', err);
    res.status(500).json({ success: false, error: 'Error al iniciar instancia de desarrollo.' });
  }
});

router.post('/detener-instancia-dev', async (req, res) => {
  try {
    await devInstanceManager.stopAll();
    res.json({ success: true });
  } catch (err) {
    console.log('Error en POST /api/despliegue/detener-instancia-dev:', err);
    res.status(500).json({ success: false, error: 'Error al detener instancia de desarrollo.' });
  }
});

router.get('/estado-instancia-dev', async (req, res) => {
  try {
    const processes = devInstanceManager.getStatus();
    res.json({ success: true, processes });
  } catch (err) {
    console.log('Error en GET /api/despliegue/estado-instancia-dev:', err);
    res.status(500).json({ success: false, error: 'Error al obtener estado de la instancia de desarrollo.' });
  }
});

export default router;
