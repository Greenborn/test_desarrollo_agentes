import { Router } from 'express';
import db from '../config/db.js';
import dbComandos from '../config/dbComandos.js';
import dbConfig from '../config/dbConfig.js';
import dbGlobalSettings from '../config/dbGlobalSettings.js';
import dbUserSettings from '../config/dbUserSettings.js';
import dbWorkspaceEnvironments from '../config/dbWorkspaceEnvironments.js';
import dbTemplates from '../config/dbTemplates.js';
import dbProjectVariables from '../config/dbProjectVariables.js';
import { encrypt, decrypt } from '../services/crypto.js';
import memoriaClient from '../services/memoriaClient.js';

const router = Router();

const TABLE_DB_MAP = {
  settings: dbConfig,
  global_settings: dbGlobalSettings,
  user_settings: dbUserSettings,
  workspace_environments: dbWorkspaceEnvironments,
  templates: dbTemplates,
  project_variables: dbProjectVariables,
};

function getDb(tableName) {
  return TABLE_DB_MAP[tableName] || db;
}

const EXPORT_TABLES = [
  'workspaces',
  'settings',
  'workspace_environments',
  'proyectos',
  'project_variables',
  'tickets',
  'templates',
  'user_settings',
  'redmine_comentarios',
  'gastos_tokens_usados',
];

const ENCRYPTED_KEYS = ['deepseek_key', 'redmine_token'];

function authGuard(req, res) {
  if (!req.session?.userId) {
    res.status(401).json({ error: 'Sesión no válida' });
    return false;
  }
  return true;
}

function isEncryptedKey(key) {
  return ENCRYPTED_KEYS.includes(key);
}

router.get('/export', async (req, res) => {
  if (!authGuard(req, res)) return;
  try {
    const tables = {};

    for (const table of EXPORT_TABLES) {
      let rows = await getDb(table)(table).orderBy('id');

      if (table === 'settings') {
        rows = rows.map(row => {
          const r = { ...row };
          if (r.encrypted && r.setting_value) {
            try {
              r.setting_value = decrypt(r.setting_value);
            } catch (errDec) {
              console.log('[state:export] Error al desencriptar', r.setting_key, ':', errDec.message);
            }
          }
          return r;
        });
      }

      tables[table] = rows;
    }

    res.json({
      version: 1,
      exported_at: new Date().toISOString(),
      tables,
    });
  } catch (err) {
    console.log('[state:export] Error:', err.message);
    res.status(500).json({ error: err.message });
  }
});

router.post('/import', async (req, res) => {
  if (!authGuard(req, res)) return;
  const { tables } = req.body;
  if (!tables || typeof tables !== 'object') {
    return res.status(400).json({ error: 'tables es requerido' });
  }

  for (const table of EXPORT_TABLES) {
    if (!Array.isArray(tables[table])) continue;

    const dbConn = getDb(table);
    const tbl = table;

    if (table === 'workspaces') {
      await dbConn(tbl).where('id', '!=', 1).del();
    } else {
      await dbConn(tbl).del();
    }
  }

  for (const table of EXPORT_TABLES) {
    const rows = tables[table];
    if (!Array.isArray(rows) || rows.length === 0) continue;

    const dbConn = getDb(table);
    const tbl = table;
    const toInsert = [];

    for (const row of rows) {
      if (table === 'workspaces' && row.id === 1) continue;

      const r = { ...row };

      if (table !== 'workspaces' && table !== 'proyectos') {
        delete r.id;
      }

      if (table === 'settings') {
        if (isEncryptedKey(r.setting_key)) {
          try {
            r.setting_value = encrypt(String(r.setting_value));
          } catch (errEnc) {
            console.log('[state:import] Error al encriptar', r.setting_key, ':', errEnc.message);
          }
          r.encrypted = 1;
        } else {
          r.encrypted = 0;
          if (typeof r.setting_value === 'object' && r.setting_value !== null) {
            r.setting_value = JSON.stringify(r.setting_value);
          } else {
            r.setting_value = String(r.setting_value ?? '');
          }
        }
      }

      toInsert.push(r);
    }

    if (toInsert.length === 0) continue;

    if (table === 'settings') {
      await dbConn(tbl).insert(toInsert).onConflict(['workspace_id', 'setting_key']).merge();
    } else if (table === 'workspace_environments') {
      await dbConn(tbl).insert(toInsert).onConflict(['workspace_id', 'name']).merge();
    } else if (table === 'project_variables') {
      await dbConn(tbl).insert(toInsert).onConflict(['proyecto_id', 'key']).merge();
    } else if (table === 'tickets') {
      await dbConn(tbl).insert(toInsert).onConflict(['redmine_id', 'workspace_id']).merge();
    } else if (table === 'templates') {
      await dbConn(tbl).insert(toInsert).onConflict('slug').merge();
    } else if (table === 'user_settings') {
      await dbConn(tbl).insert(toInsert).onConflict(['user_id', 'key']).merge();
    } else if (table === 'workspaces') {
      await dbConn(tbl).insert(toInsert).onConflict('id').merge();
    } else {
      for (const item of toInsert) {
        await dbConn(tbl).insert(item);
      }
    }
  }

  res.json({ success: true });
});

router.get('/ui', async (req, res) => {
  if (!authGuard(req, res)) return;
  try {
    const data = await memoriaClient.get('ui_state', `user_${req.session.userId}`);
    res.json({ state: data?.value || null });
  } catch (err) {
    console.log('[state:ui] Error al leer estado UI:', err.message);
    res.json({ state: null });
  }
});

router.post('/ui', async (req, res) => {
  if (!authGuard(req, res)) return;
  try {
    const { state } = req.body;
    if (!state || typeof state !== 'object') {
      return res.status(400).json({ error: 'state debe ser un objeto' });
    }
    const key = `user_${req.session.userId}`;
    const existing = await memoriaClient.get('ui_state', key);
    const merged = { ...(existing?.value || {}), ...state };
    await memoriaClient.set('ui_state', key, merged, 86400);
    res.json({ success: true });
  } catch (err) {
    console.log('[state:ui] Error al guardar estado UI:', err.message);
    res.status(500).json({ error: err.message });
  }
});

export default router;
