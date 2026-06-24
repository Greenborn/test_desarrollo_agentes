import { Router } from 'express';
import db from '../config/db.js';
import { encrypt, decrypt } from '../services/crypto.js';

const router = Router();

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
      let rows = await db(table).orderBy('id');

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

  const trx = await db.transaction();

  try {
    await trx.raw('SET FOREIGN_KEY_CHECKS = 0');

    for (const table of EXPORT_TABLES) {
      if (!Array.isArray(tables[table])) continue;

      if (table === 'workspaces') {
        await trx('workspaces').where('id', '!=', 1).del();
      } else {
        await trx(table).del();
      }
    }

    for (const table of EXPORT_TABLES) {
      const rows = tables[table];
      if (!Array.isArray(rows) || rows.length === 0) continue;

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
        await trx('settings').insert(toInsert).onConflict(['workspace_id', 'setting_key']).merge();
      } else if (table === 'workspace_environments') {
        await trx('workspace_environments').insert(toInsert).onConflict(['workspace_id', 'name']).merge();
      } else if (table === 'project_variables') {
        await trx('project_variables').insert(toInsert).onConflict(['proyecto_id', 'key']).merge();
      } else if (table === 'tickets') {
        await trx('tickets').insert(toInsert).onConflict('redmine_id').merge();
      } else if (table === 'templates') {
        await trx('templates').insert(toInsert).onConflict('slug').merge();
      } else if (table === 'user_settings') {
        await trx('user_settings').insert(toInsert).onConflict(['user_id', 'key']).merge();
      } else if (table === 'workspaces') {
        await trx('workspaces').insert(toInsert).onConflict('id').merge();
      } else {
        for (const item of toInsert) {
          await trx(table).insert(item);
        }
      }
    }

    await trx.raw('SET FOREIGN_KEY_CHECKS = 1');
    await trx.commit();

    res.json({ success: true });
  } catch (err) {
    await trx.rollback();
    console.log('[state:import] Error:', err.message);
    res.status(500).json({ success: false, error: err.message });
  }
});

export default router;
