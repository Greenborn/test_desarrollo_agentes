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
      } else if (row.setting_key.startsWith('documentacion_prompt_')) {
        keys[row.setting_key] = row.setting_value;
      }
    }
    const defaults = {
      documentacion_prompt_base_datos: 'Analiza el proyecto actual y documenta la estructura de la base de datos, incluyendo tablas, columnas, relaciones, índices y cualquier otra información relevante sobre el esquema de datos. Proporciona una descripción detallada que permita a otros agentes entender la arquitectura de datos del proyecto.',
      documentacion_prompt_subproyectos: 'Analiza el proyecto actual e identifica todos los subproyectos que lo componen. Para cada subproyecto, proporciona un nombre identificativo y una descripción breve pero suficientemente descriptiva para que otros agentes de IA puedan entender su propósito y alcance. Devuelve la información en formato estructurado.',
      documentacion_prompt_endpoints: 'Analiza el proyecto actual y documenta todos los endpoints de la API, incluyendo método HTTP, ruta, parámetros, cuerpo de la solicitud, respuesta y cualquier detalle relevante de cada endpoint. Proporciona una descripción detallada que permita a otros agentes entender y consumir la API.',
      documentacion_prompt_web_sockets: 'Analiza el proyecto actual y documenta todos los eventos y canales de WebSocket, incluyendo el nombre del evento, payload, dirección (cliente-servidor o servidor-cliente) y cualquier detalle relevante. Proporciona una descripción detallada que permita a otros agentes entender la comunicación en tiempo real del proyecto.',
      documentacion_prompt_funcionalidades: 'Analiza el proyecto actual y documenta todas las funcionalidades implementadas, incluyendo nombre, descripción, módulo al que pertenece, dependencias y cualquier detalle relevante. Proporciona una descripción detallada que permita a otros agentes entender el alcance funcional del proyecto.',
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
