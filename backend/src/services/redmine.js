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
