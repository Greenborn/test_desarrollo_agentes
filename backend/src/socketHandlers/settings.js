import db from '../config/db.js';
import { encrypt, decrypt } from '../services/crypto.js';

function getSessionUser(socket) {
  try {
    const sid = socket.request.session?.userId;
    return sid ? { id: sid } : null;
  } catch (err) {
    console.log('Error en getSessionUser:', err.message);
    return null;
  }
}

export default function registerSettingsHandlers(io, socket, userId, username) {
  function authGuard() {
    try {
      const su = getSessionUser(socket);
      if (!su) socket.emit('auth:me', null);
      return !!su;
    } catch (err) {
      console.log('Error en authGuard settings:', err.message);
      return false;
    }
  }

  socket.on('settings:get', async () => {
    try {
      if (!authGuard()) return;
      const rows = await db('settings').select('setting_key', 'setting_value', 'encrypted');
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
        } else if (row.setting_key === 'system_prompt') {
          keys.system_prompt = row.setting_value;
        }
      }
      socket.emit('settings:get_res', keys);
    } catch (err) {
      console.log('Error en settings:get:', err.message);
      socket.emit('settings:get_res', {});
    }
  });

  socket.on('settings:set', async ({ key, value }) => {
    try {
      if (!authGuard()) return;
      let toStore = value;
      let encrypted = false;

      if (key === 'deepseek_key') {
        toStore = encrypt(value);
        encrypted = true;
      }

      await db('settings')
        .insert({ setting_key: key, setting_value: toStore, encrypted })
        .onConflict('setting_key')
        .merge();

      socket.emit('settings:set_res', { success: true });
    } catch (err) {
      console.log('Error en settings:set:', err.message);
      socket.emit('settings:set_res', { success: false, error: err.message });
    }
  });
}
