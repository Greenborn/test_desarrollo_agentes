import { Router } from 'express';
import { execSync } from 'child_process';
import path from 'path';
import { fileURLToPath } from 'url';
import fs from 'fs';
import db from '../config/db.js';
import { encrypt, decrypt } from '../services/crypto.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

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
    const wsId = req.query.workspace_id ? parseInt(req.query.workspace_id, 10) : wsIds[0] || 1;
    const rows = await db('settings').where({ workspace_id: wsId }).select('setting_key', 'setting_value', 'encrypted');
    const keys = {};
    for (const row of rows) {
      if (row.setting_key === 'deepseek_key' && row.setting_value) {
        try {
          const decrypted = decrypt(row.setting_value);
          keys.deepseek_key = decrypted.slice(0, 10) + '...';
        } catch (errDec) {
          console.log('Error al desencriptar deepseek_key:', errDec.message);
          keys.deepseek_key = row.setting_value.slice(0, 10) + '...';
        }
      } else if (row.setting_key === 'redmine_token' && row.setting_value) {
        try {
          const decrypted = decrypt(row.setting_value);
          keys.redmine_token = decrypted.slice(0, 10) + '...';
        } catch (errDec) {
          console.log('Error al desencriptar redmine_token:', errDec.message);
          keys.redmine_token = row.setting_value.slice(0, 10) + '...';
        }
      } else if (row.setting_key === 'redmine_url') {
        keys.redmine_url = row.setting_value;
      } else if (row.setting_key === 'system_prompt') {
        keys.system_prompt = row.setting_value;
      } else if (row.setting_key.startsWith('documentacion_prompt_')) {
        keys[row.setting_key] = row.setting_value;
      } else if (row.setting_key === 'ticket_descripcion_prompt') {
        keys.ticket_descripcion_prompt = row.setting_value;
      } else if (row.setting_key === 'deteccion_funcionalidades_prompt') {
        keys.deteccion_funcionalidades_prompt = row.setting_value;
      } else if (row.setting_key === 'code_file_extensions') {
        keys.code_file_extensions = row.setting_value;
      } else if (row.setting_key === 'code_file_max_size_kb') {
        keys.code_file_max_size_kb = row.setting_value;
      } else if (row.setting_key === 'ticket_refinar_prompt') {
        keys.ticket_refinar_prompt = row.setting_value;
      } else if (row.setting_key === 'repo_acronimo') {
        keys.repo_acronimo = row.setting_value;
      } else if (row.setting_key === 'locale') {
        keys.locale = row.setting_value;
      } else if (row.setting_key === 'screen_resolutions') {
        try {
          keys.screen_resolutions = JSON.parse(row.setting_value);
        } catch (err) { console.log('[settings] Error al parsear screen_resolutions:', err.message); keys.screen_resolutions = []; }
      } else if (row.setting_key.startsWith('priority_color_')) {
        keys[row.setting_key] = row.setting_value;
      } else if (row.setting_key === 'replay_interval_ms') {
        keys.replay_interval_ms = row.setting_value;
      } else if (row.setting_key === 'request_response_max_size_kb') {
        keys.request_response_max_size_kb = row.setting_value;
      } else if (row.setting_key === 'browser_stealth_enabled') {
        keys.browser_stealth_enabled = row.setting_value;
      } else if (row.setting_key === 'browser_user_agent_chrome') {
        keys.browser_user_agent_chrome = row.setting_value;
      } else if (row.setting_key === 'browser_user_agent_firefox') {
        keys.browser_user_agent_firefox = row.setting_value;
      } else if (row.setting_key === 'skill_repository_url') {
        keys.skill_repository_url = row.setting_value;
      } else if (row.setting_key === 'terminal_max_terminals') {
        keys.terminal_max_terminals = row.setting_value;
      } else if (row.setting_key === 'default_comment_mode_commit') {
        keys.default_comment_mode_commit = row.setting_value;
      } else if (row.setting_key === 'default_comment_mode_ticket') {
        keys.default_comment_mode_ticket = row.setting_value;
      } else if (row.setting_key === 'default_comment_mode_diff') {
        keys.default_comment_mode_diff = row.setting_value;
      }
    }
    const defaults = {
      documentacion_prompt_base_datos: 'Analiza el proyecto actual y documenta la estructura de la base de datos, incluyendo tablas, columnas, relaciones, índices y cualquier otra información relevante sobre el esquema de datos. Proporciona una descripción detallada que permita a otros agentes entender la arquitectura de datos del proyecto.',
      documentacion_prompt_subproyectos: 'Analiza el proyecto actual e identifica todos los subproyectos que lo componen. Para cada subproyecto, proporciona un nombre identificativo y una descripción breve pero suficientemente descriptiva para que otros agentes de IA puedan entender su propósito y alcance. Devuelve la información en formato estructurado.',
      documentacion_prompt_endpoints: 'Analiza el proyecto actual y documenta todos los endpoints de la API, incluyendo método HTTP, ruta, parámetros, cuerpo de la solicitud, respuesta y cualquier detalle relevante de cada endpoint. Proporciona una descripción detallada que permita a otros agentes entender y consumir la API.',
      documentacion_prompt_web_sockets: 'Analiza el proyecto actual y documenta todos los eventos y canales de WebSocket, incluyendo el nombre del evento, payload, dirección (cliente-servidor o servidor-cliente) y cualquier detalle relevante. Proporciona una descripción detallada que permita a otros agentes entender la comunicación en tiempo real del proyecto.',
      documentacion_prompt_funcionalidades: 'Analiza el proyecto actual y documenta todas las funcionalidades implementadas, incluyendo nombre, descripción, módulo al que pertenece, dependencias y cualquier detalle relevante. Proporciona una descripción detallada que permita a otros agentes entender el alcance funcional del proyecto.',
      ticket_descripcion_prompt: 'Eres un asistente experto en redactar descripciones técnicas para tickets de Redmine. Tu objetivo principal es generar una descripción ÓPTIMA y detallada para el siguiente ticket:\n\nContexto del ticket:\n- Título: {subject}\n- Estado actual: {status}\n- Prioridad: {priority}\n- Asignado a: {assigned_to}\n\nInstrucciones:\n1. Genera una descripción clara, precisa y bien estructurada que explique el problema o requerimiento del ticket.\n2. Utiliza la siguiente solicitud del usuario como guía para el contenido:\n{user_input}\n3. La descripción debe ser profesional, técnica y útil para desarrolladores.\n4. Incluye solo información relevante al ticket, sin divagaciones.',
      ticket_refinar_prompt: 'Eres un asistente especializado en refinar descripciones técnicas de tickets para Redmine. Toma la descripción proporcionada y transfórmala en una descripción estructurada con las siguientes secciones:\n\n## Objetivo\nDescripción general de la tarea o cambio a realizar, explicando el propósito y la idea principal.\n\n## Cambios a realizar\nInforme detallado a medio nivel de los cambios concretos que deben aplicarse, organizado de forma clara.\n\nReglas:\n- No inventes nada que no esté presente en el texto original.\n- Sé conciso y técnico, apropiado para desarrolladores.\n- Devuelve únicamente la descripción formateada, sin comentarios adicionales.',
      deteccion_funcionalidades_prompt: 'Analizá el proyecto en el directorio actual e identificá todas las funcionalidades implementadas.\n\nLa respuesta debe estar estructurada en formato Markdown con la siguiente jerarquía:\n\n# [Nombre del Subproyecto] (backend | frontend)\n\n## [Módulo o Conjunto de Rutas]\n\n### Si es backend:\n- Endpoint, método HTTP, tablas utilizadas, permisos requeridos\n\n### Si es frontend:\n- Componente, ruta Vue Router, propósito, otros componentes usados, composables, endpoints llamados\n\nUsá tablas cuando sea apropiado para listar múltiples elementos con sus propiedades. Identificá cada funcionalidad a partir del código fuente, incluyendo archivos backend (rutas, controladores, modelos) y frontend (componentes Vue, vistas, stores).',
      code_file_extensions: '.js,.jsx,.ts,.tsx,.vue,.py,.php,.java,.rb,.go,.rs,.c,.cpp,.h,.hpp,.cs,.swift,.kt,.scala,.sh,.bash,.pl,.lua,.r,.m,.mm,.css,.scss,.less,.sass,.html,.sql,.json',
      code_file_max_size_kb: '1024',
      repo_acronimo: 'TKT',
      locale: 'es_ES.UTF-8',
      priority_color_low: '#6b7280',
      priority_color_normal: '#3b82f6',
      priority_color_high: '#eab308',
      priority_color_urgent: '#ef4444',
      priority_color_immediate: '#ef4444',
      replay_interval_ms: '1000',
      request_response_max_size_kb: '100',
      browser_stealth_enabled: '0',
      browser_user_agent_chrome: '',
      browser_user_agent_firefox: '',
      terminal_max_terminals: '5',
      default_comment_mode_commit: 'encolar',
      default_comment_mode_ticket: 'encolar',
      default_comment_mode_diff: 'encolar',
      screen_resolutions: [
        { id: 'fullhd', width: 1920, height: 1080 },
        { id: 'hd', width: 1366, height: 768 },
        { id: 'hd_plus', width: 1600, height: 900 },
        { id: 'qhd', width: 2560, height: 1440 },
        { id: '4k', width: 3840, height: 2160 },
        { id: 'macbook_air', width: 2560, height: 1664 },
        { id: 'macbook_pro', width: 3024, height: 1964 },
        { id: 'iphone_14', width: 390, height: 844 },
        { id: 'iphone_14_pro_max', width: 430, height: 932 },
        { id: 'iphone_se', width: 375, height: 667 },
        { id: 'pixel_7', width: 412, height: 915 },
        { id: 'samsung_s23', width: 360, height: 780 },
        { id: 'ipad_air', width: 820, height: 1180 },
        { id: 'ipad_mini', width: 744, height: 1133 },
      ],
    };
    for (const [key, def] of Object.entries(defaults)) {
      if (!keys[key]) keys[key] = def;
    }
    res.json(keys);
  } catch (err) {
    console.log('Error al obtener settings:', err.message);
    res.status(500).json({});
  }
});

router.get('/global', async (req, res) => {
  if (!authGuard(req, res)) return;
  try {
    const rows = await db('global_settings').select('setting_key', 'setting_value');
    const keys = {};
    for (const row of rows) {
      keys[row.setting_key] = row.setting_value;
    }
    const defaults = {
      ticket_descripcion_mejorar_prompt: 'Eres un asistente experto en redactar prompts técnicos para agentes OpenCode a partir de notas de reunión. Toma el contenido proporcionado (notas de reunión y datos adicionales) y genera un prompt claro, estructurado y autosuficiente que un agente OpenCode pueda ejecutar. El prompt debe incluir contexto técnico, objetivo y pasos concretos si aplica. No inventes información. Devuelve únicamente el prompt, sin comentarios adicionales.',
      ticket_objetivo_prompt: 'Eres un asistente experto en redactar objetivos técnicos a partir de notas de reunión. Genera un objetivo claro y conciso que resuma el propósito del ticket. Devuelve únicamente el objetivo, sin comentarios adicionales.',
      ticket_plantilla_descripcion: '## Objetivo\n{{objetivo}}\n## Notas Reunión\n{{notas_reunion}}\n## Promt Agente\n{{promt_opencode}}',
    };
    for (const [key, def] of Object.entries(defaults)) {
      if (!keys[key]) keys[key] = def;
    }
    res.json(keys);
  } catch (err) {
    console.log('Error al obtener settings globales:', err.message);
    res.status(500).json({});
  }
});

router.post('/global', async (req, res) => {
  if (!authGuard(req, res)) return;
  try {
    const { key, value } = req.body;
    if (!key) {
      return res.status(400).json({ error: 'key es requerido' });
    }
    await db('global_settings')
      .insert({ setting_key: key, setting_value: String(value) })
      .onConflict('setting_key')
      .merge();
    res.json({ success: true });
  } catch (err) {
    console.log('Error al guardar setting global:', err.message);
    res.status(500).json({ success: false, error: err.message });
  }
});

router.post('/', async (req, res) => {
  if (!authGuard(req, res)) return;
  try {
    const { key, value, workspace_id } = req.body;
    const wsIds = req.session.workspaceIds || [1];
    const wsId = workspace_id && wsIds.includes(workspace_id) ? workspace_id : wsIds[0] || 1;
    let toStore = value;
    let encrypted = false;

    if (key === 'deepseek_key' || key === 'redmine_token') {
      toStore = encrypt(value);
      encrypted = true;
    }

    await db('settings')
      .insert({ workspace_id: wsId, setting_key: key, setting_value: toStore, encrypted })
      .onConflict(['workspace_id', 'setting_key'])
      .merge();

    res.json({ success: true });
  } catch (err) {
    console.log('Error al guardar setting:', err.message);
    res.status(500).json({ success: false, error: err.message });
  }
});

router.get('/export-all', async (req, res) => {
  if (!authGuard(req, res)) return;
  try {
    const workspaces = await db('workspaces').select('id', 'name').orderBy('id');
    const configuracionGeneral = {};

    for (const ws of workspaces) {
      const settingsRows = await db('settings')
        .where({ workspace_id: ws.id })
        .select('setting_key', 'setting_value', 'encrypted');

      const keys = {};
      for (const row of settingsRows) {
        let value = row.setting_value;
        if (row.encrypted && value) {
          try {
            value = decrypt(value);
          } catch (errDec) {
            console.log('Error al desencriptar', row.setting_key, ':', errDec.message);
          }
        }
        if (row.setting_key === 'screen_resolutions') {
          try { keys.screen_resolutions = JSON.parse(value); } catch (err) { console.log('[settings] Error al parsear screen_resolutions en export:', err.message); keys.screen_resolutions = []; }
        } else {
          keys[row.setting_key] = value;
        }
      }

      const environments = await db('workspace_environments')
        .where({ workspace_id: ws.id })
        .select('name', 'branch', 'description')
        .orderBy('id');

      const wsData = { ...keys };
      if (environments.length > 0) {
        wsData.ambientes = environments.map(e => ({
          nombre: e.name,
          rama: e.branch,
          descripcion: e.description,
        }));
      }

      configuracionGeneral[ws.name] = wsData;
    }

    const globalRows = await db('global_settings').select('setting_key', 'setting_value');
    const globalKeys = {};
    for (const row of globalRows) {
      globalKeys[row.setting_key] = row.setting_value;
    }

    res.json({
      version: 1,
      exported_at: new Date().toISOString(),
      configuracion_general: globalKeys,
      workspaces: configuracionGeneral,
    });
  } catch (err) {
    console.log('Error al exportar settings:', err.message);
    res.status(500).json({ error: err.message });
  }
});

router.post('/import-all', async (req, res) => {
  if (!authGuard(req, res)) return;
  try {
    const { workspaces, configuracion_general } = req.body;
    if (!workspaces || typeof workspaces !== 'object') {
      return res.status(400).json({ error: 'workspaces es requerido' });
    }

    if (configuracion_general && typeof configuracion_general === 'object') {
      for (const [key, value] of Object.entries(configuracion_general)) {
        await db('global_settings')
          .insert({ setting_key: key, setting_value: String(value) })
          .onConflict('setting_key')
          .merge();
      }
    }

    for (const [wsName, wsData] of Object.entries(workspaces)) {
      const ws = await db('workspaces').where({ name: wsName }).first();
      if (!ws) {
        console.log('Workspace no encontrado para importar:', wsName);
        continue;
      }

      const { ambientes, ...settingsKeys } = wsData;

      for (const [key, value] of Object.entries(settingsKeys)) {
        let toStore = String(value);
        let encrypted = false;

        if (key === 'deepseek_key' || key === 'redmine_token') {
          toStore = encrypt(String(value));
          encrypted = true;
        }

        if (key === 'screen_resolutions') {
          toStore = JSON.stringify(value);
        }

        await db('settings')
          .insert({ workspace_id: ws.id, setting_key: key, setting_value: toStore, encrypted })
          .onConflict(['workspace_id', 'setting_key'])
          .merge();
      }

      if (Array.isArray(ambientes)) {
        for (const env of ambientes) {
          if (!env.nombre || !env.rama) continue;
          await db('workspace_environments')
            .insert({
              workspace_id: ws.id,
              name: env.nombre,
              branch: env.rama,
              description: env.descripcion || null,
            })
            .onConflict(['workspace_id', 'name'])
            .merge();
        }
      }
    }

    res.json({ success: true });
  } catch (err) {
    console.log('Error al importar settings:', err.message);
    res.status(500).json({ success: false, error: err.message });
  }
});

const OPENCODE_DEV_DIR = path.resolve(__dirname, '../../../opencode_dev');

router.post('/clone-skill-repo', async (req, res) => {
  if (!authGuard(req, res)) return;
  try {
    const { workspace_id } = req.body;
    const wsIds = req.session.workspaceIds || [1];
    const wsId = workspace_id && wsIds.includes(workspace_id) ? workspace_id : wsIds[0] || 1;

    const ws = await db('workspaces').where({ id: wsId }).first();
    if (!ws) {
      return res.status(404).json({ error: 'Workspace no encontrado' });
    }

    const setting = await db('settings')
      .where({ workspace_id: wsId, setting_key: 'skill_repository_url' })
      .first();

    if (!setting || !setting.setting_value) {
      return res.status(400).json({ error: 'No hay URL de repositorio configurada para este workspace' });
    }

    const repoUrl = setting.setting_value.trim();
    const targetDir = path.join(OPENCODE_DEV_DIR, ws.slug);

    if (!fs.existsSync(targetDir)) {
      fs.mkdirSync(targetDir, { recursive: true });
    }

    const isEmpty = fs.readdirSync(targetDir).length === 0;

    if (isEmpty) {
      execSync(`git clone "${repoUrl}" "${targetDir}"`, {
        stdio: 'pipe',
        timeout: 120000,
      });
    } else {
      execSync(`git -C "${targetDir}" pull`, {
        stdio: 'pipe',
        timeout: 120000,
      });
    }

    res.json({ success: true, slug: ws.slug, path: targetDir });
  } catch (err) {
    console.log('Error al clonar repositorio de skills:', err.message);
    res.status(500).json({ success: false, error: err.message });
  }
});

export default router;
