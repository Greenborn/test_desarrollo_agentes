import express from 'express';
import fs from 'fs';
import path from 'path';
import db from '../config/db.js';
import * as devInstanceManager from '../services/devInstanceManager.js';
import playwrightManager from '../services/playwrightManager.js';

const PW_PORT = process.env.SERVICIO_PLAYWRIGHT_PORT || 4098;
const router = express.Router();

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
        error: 'La sesión de chat no está vinculada a un proyecto. Use /chat_set_proyecto para seleccionar un proyecto.',
      });
    }

    const projectDir = session.cwd || process.cwd();
    const deployPath = path.resolve(projectDir, 'deploy.json');

    if (!fs.existsSync(deployPath)) {
      return res.json({
        success: false,
        code: 'MISSING_DEPLOY_JSON',
        cwd: projectDir,
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

function scanSubprojects(rootDir) {
  const results = [];
  const entries = fs.readdirSync(rootDir, { withFileTypes: true });
  for (const entry of entries) {
    if (!entry.isDirectory() || entry.name === 'node_modules' || entry.name.startsWith('.')) continue;
    const subDir = path.join(rootDir, entry.name);
    const pkgPath = path.join(subDir, 'package.json');
    if (fs.existsSync(pkgPath)) {
      let pkg = {};
      try {
        pkg = JSON.parse(fs.readFileSync(pkgPath, 'utf-8'));
      } catch (err) { console.log('[despliegue] Error al parsear package.json:', err.message); }
      const name = pkg.name || entry.name;
      const hasExpress = (pkg.dependencies && pkg.dependencies.express) || (pkg.devDependencies && pkg.devDependencies.express);
      const hasVue = (pkg.dependencies && (pkg.dependencies.vue || pkg.dependencies['vue-router'])) ||
                     (pkg.devDependencies && (pkg.devDependencies.vue || pkg.devDependencies['vue-router']));
      const hasVite = (pkg.devDependencies && pkg.devDependencies.vite) || (pkg.scripts && pkg.scripts.dev && pkg.scripts.dev.includes('vite'));
      const type = hasVue && (hasVite || hasExpress === false) ? 'frontend' : hasExpress ? 'backend' : 'backend';
      results.push({ name, cwd: subDir, type });
    }
  }
  return results;
}

router.post('/crear-config', async (req, res) => {
  try {
    const { sessionId, dir } = req.body;

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
        error: 'La sesión de chat no está vinculada a un proyecto. Use /chat_set_proyecto para seleccionar un proyecto.',
      });
    }

    const projectDir = dir || session.cwd;
    if (!projectDir) {
      return res.status(400).json({ success: false, error: 'No se pudo determinar el directorio del proyecto.' });
    }

    if (!fs.existsSync(projectDir)) {
      return res.status(400).json({ success: false, error: `El directorio no existe: ${projectDir}` });
    }

    const subprojects = scanSubprojects(projectDir);

    if (subprojects.length === 0) {
      return res.status(400).json({
        success: false,
        error: `No se encontraron subproyectos con package.json en: ${projectDir}`,
      });
    }

    const deployConfig = {
      install: subprojects.map(sp => ({ cwd: sp.cwd })),
      pm2: subprojects.filter(sp => sp.type === 'backend').map(sp => ({ cwd: sp.cwd })),
      build: subprojects.filter(sp => sp.type === 'frontend').map(sp => ({ cwd: sp.cwd })),
    };

    const deployPath = path.resolve(projectDir, 'deploy.json');
    fs.writeFileSync(deployPath, JSON.stringify(deployConfig, null, 2), 'utf-8');

    await db('proyectos')
      .where({ id: session.proyecto_id })
      .update({ despliegue_config: JSON.stringify(deployConfig) });

    res.json({
      success: true,
      message: `deploy.json creado en ${deployPath} con ${subprojects.length} subproyecto(s) detectado(s).`,
      config: deployConfig,
    });
  } catch (err) {
    console.log('Error en POST /api/despliegue/crear-config:', err);
    res.status(500).json({ success: false, error: 'Error al crear configuración de despliegue.' });
  }
});

router.post('/save-config', async (req, res) => {
  try {
    const { sessionId, subprojects } = req.body;

    if (!sessionId) {
      return res.status(400).json({ success: false, error: 'Se requiere sessionId.' });
    }

    if (!subprojects || !Array.isArray(subprojects) || subprojects.length === 0) {
      return res.status(400).json({ success: false, error: 'Se requiere un array de subproyectos (subprojects).' });
    }

    for (const sp of subprojects) {
      if (!sp.cwd || !sp.type) {
        return res.status(400).json({ success: false, error: 'Cada subproyecto debe tener cwd y type.' });
      }
      if (sp.type !== 'backend' && sp.type !== 'frontend') {
        return res.status(400).json({ success: false, error: `Tipo inválido "${sp.type}" para "${sp.cwd}". Debe ser "backend" o "frontend".` });
      }
    }

    const session = await db('chat_sessions')
      .where({ id: sessionId, user_id: req.session.userId })
      .select('proyecto_id', 'cwd')
      .first();

    if (!session || !session.proyecto_id) {
      return res.status(400).json({
        success: false,
        error: 'La sesión de chat no está vinculada a un proyecto. Use /chat_set_proyecto para seleccionar un proyecto.',
      });
    }

    const projectDir = session.cwd || process.cwd();

    const deployConfig = {
      install: subprojects.map(sp => ({ cwd: sp.cwd })),
      pm2: subprojects.filter(sp => sp.type === 'backend').map(sp => ({ cwd: sp.cwd })),
      build: subprojects.filter(sp => sp.type === 'frontend').map(sp => ({ cwd: sp.cwd })),
    };

    const deployPath = path.resolve(projectDir, 'deploy.json');
    fs.writeFileSync(deployPath, JSON.stringify(deployConfig, null, 2), 'utf-8');

    await db('proyectos')
      .where({ id: session.proyecto_id })
      .update({ despliegue_config: JSON.stringify(deployConfig) });

    res.json({ success: true, message: 'Configuración de despliegue creada y guardada correctamente.' });
  } catch (err) {
    console.log('Error en POST /api/despliegue/save-config:', err);
    res.status(500).json({ success: false, error: 'Error al guardar configuración de despliegue.' });
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
        error: 'La sesión de chat no está vinculada a un proyecto. Use /chat_set_proyecto para seleccionar un proyecto.',
      });
    }

    const proyecto = await db('proyectos')
      .where({ id: session.proyecto_id })
      .select('despliegue_config')
      .first();

    if (!proyecto || !proyecto.despliegue_config) {
      return res.status(404).json({
        success: false,
        error: 'No hay configuración de despliegue guardada. Use /despliegue_actualizar_config para cargarla.',
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
        error: 'La sesión de chat no está vinculada a un proyecto. Use /chat_set_proyecto para seleccionar un proyecto.',
      });
    }

    const proyecto = await db('proyectos')
      .where({ id: session.proyecto_id })
      .select('despliegue_config')
      .first();

    if (!proyecto || !proyecto.despliegue_config) {
      return res.status(400).json({
        success: false,
        error: 'No hay configuración de despliegue guardada. Use /despliegue_actualizar_config para cargarla.',
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

    const results = await devInstanceManager.startDevInstance(projectRoot, deployConfig, sessionId);

    const allPorts = await devInstanceManager.waitForAllPorts(sessionId, 20000);

    for (const r of results) {
      const info = allPorts.find(p => p.name === r.name);
      if (info) {
        r.port = info.port;
        r.url = info.url;
      }
    }

    const frontendPorts = allPorts.filter(p => p.type === 'frontend');

    const browserSessions = [];
    let resolution = null;

    if (frontendPorts.length > 0) {
      try {
        await playwrightManager.ensureRunning();

        if (customResolution && customResolution.width && customResolution.height) {
          resolution = customResolution;
        } else {
          try {
            const defaultResRow = await db('user_settings')
              .select('value')
              .where({ user_id: req.session.userId, key: 'default_resolution' })
              .first();
            if (defaultResRow && defaultResRow.value) {
              const wsIds = req.session.workspaceIds || [1];
              const screenResRow = await db('settings')
                .select('setting_value')
                .where({ workspace_id: wsIds[0] || 1, setting_key: 'screen_resolutions' })
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
              const parametros = { navegador: 'chrome', url: fe.url, chat_session_id: sessionId, instance_name: fe.name };
              if (resolution) parametros.resolution = resolution;

              const pwRes = await fetch(`http://localhost:${PW_PORT}/api/command`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ comando: 'start', parametros }),
              });
            const pwData = await pwRes.json();
            if (pwData.id_session) {
              browserSessions.push({ name: fe.name, url: fe.url, idSession: pwData.id_session });
              devInstanceManager.registerBrowserSession(sessionId, { name: fe.name, url: fe.url, idSession: pwData.id_session });
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

    devInstanceManager.setFrontendPorts(frontendPorts, sessionId);
    devInstanceManager.setResolution(resolution, sessionId);

    res.json({ success: true, results, frontendPorts, browserSessions });
  } catch (err) {
    console.log('Error en POST /api/despliegue/iniciar-instancia-dev:', err);
    res.status(500).json({ success: false, error: 'Error al iniciar instancia de desarrollo.' });
  }
});

router.post('/detener-instancia-dev', async (req, res) => {
  try {
    const { sessionId } = req.body;
    if (sessionId) {
      await devInstanceManager.stopBySession(sessionId);
    } else {
      await devInstanceManager.stopAll();
    }
    res.json({ success: true });
  } catch (err) {
    console.log('Error en POST /api/despliegue/detener-instancia-dev:', err);
    res.status(500).json({ success: false, error: 'Error al detener instancia de desarrollo.' });
  }
});

router.post('/cerrar-puertos', async (req, res) => {
  try {
    const { ports } = req.body;

    if (!ports || !Array.isArray(ports) || ports.length === 0) {
      return res.status(400).json({ success: false, error: 'Se requiere un array de puertos.' });
    }

    const results = devInstanceManager.killPorts(ports);
    res.json({ success: true, results });
  } catch (err) {
    console.log('Error en POST /api/despliegue/cerrar-puertos:', err);
    res.status(500).json({ success: false, error: 'Error al cerrar puertos.' });
  }
});

router.get('/estado-instancia-dev', async (req, res) => {
  try {
    const { sessionId } = req.query;
    const status = devInstanceManager.getStatus(sessionId || null);
    res.json({ success: true, ...status });
  } catch (err) {
    console.log('Error en GET /api/despliegue/estado-instancia-dev:', err);
    res.status(500).json({ success: false, error: 'Error al obtener estado de la instancia de desarrollo.' });
  }
});

router.get('/logs', async (req, res) => {
  try {
    const { sessionId, name } = req.query;
    if (!name) {
      return res.status(400).json({ success: false, error: 'Se requiere el parámetro name.' });
    }
    if (!sessionId) {
      return res.status(400).json({ success: false, error: 'Se requiere el parámetro sessionId.' });
    }
    const logs = devInstanceManager.getLogs(sessionId, name);
    res.json({ success: true, name, logs });
  } catch (err) {
    console.log('Error en GET /api/despliegue/logs:', err);
    res.status(500).json({ success: false, error: 'Error al obtener logs.' });
  }
});

export default router;
