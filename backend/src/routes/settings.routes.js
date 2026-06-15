import { Router } from 'express';
import db from '../config/db.js';
import { encrypt, decrypt } from '../services/crypto.js';

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
      } else if (row.setting_key === 'documentacion_prompt_subproyectos') {
        keys.documentacion_prompt_subproyectos = row.setting_value;
      }
    }
    if (!keys.documentacion_prompt_subproyectos) {
      keys.documentacion_prompt_subproyectos = 'Analiza el proyecto actual e identifica todos los subproyectos que lo componen. Para cada subproyecto, proporciona un nombre identificativo y una descripción breve pero suficientemente descriptiva para que otros agentes de IA puedan entender su propósito y alcance. Devuelve la información en formato estructurado.';
    }
    res.json(keys);
  } catch (err) {
    console.log('Error al obtener settings:', err.message);
    res.status(500).json({});
  }
});

router.post('/', async (req, res) => {
  if (!authGuard(req, res)) return;
  try {
    const { key, value } = req.body;
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

    res.json({ success: true });
  } catch (err) {
    console.log('Error al guardar setting:', err.message);
    res.status(500).json({ success: false, error: err.message });
  }
});

export default router;
