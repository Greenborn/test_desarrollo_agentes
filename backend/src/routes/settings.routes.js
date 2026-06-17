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
    const wsId = req.session.workspaceId || 1;
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
      } else if (row.setting_key === 'omnifilter_debounce_ms') {
        keys.omnifilter_debounce_ms = row.setting_value;
      } else if (row.setting_key === 'ticket_descripcion_prompt') {
        keys.ticket_descripcion_prompt = row.setting_value;
      }
    }
    const defaults = {
      documentacion_prompt_base_datos: 'Analiza el proyecto actual y documenta la estructura de la base de datos, incluyendo tablas, columnas, relaciones, índices y cualquier otra información relevante sobre el esquema de datos. Proporciona una descripción detallada que permita a otros agentes entender la arquitectura de datos del proyecto.',
      documentacion_prompt_subproyectos: 'Analiza el proyecto actual e identifica todos los subproyectos que lo componen. Para cada subproyecto, proporciona un nombre identificativo y una descripción breve pero suficientemente descriptiva para que otros agentes de IA puedan entender su propósito y alcance. Devuelve la información en formato estructurado.',
      documentacion_prompt_endpoints: 'Analiza el proyecto actual y documenta todos los endpoints de la API, incluyendo método HTTP, ruta, parámetros, cuerpo de la solicitud, respuesta y cualquier detalle relevante de cada endpoint. Proporciona una descripción detallada que permita a otros agentes entender y consumir la API.',
      documentacion_prompt_web_sockets: 'Analiza el proyecto actual y documenta todos los eventos y canales de WebSocket, incluyendo el nombre del evento, payload, dirección (cliente-servidor o servidor-cliente) y cualquier detalle relevante. Proporciona una descripción detallada que permita a otros agentes entender la comunicación en tiempo real del proyecto.',
      documentacion_prompt_funcionalidades: 'Analiza el proyecto actual y documenta todas las funcionalidades implementadas, incluyendo nombre, descripción, módulo al que pertenece, dependencias y cualquier detalle relevante. Proporciona una descripción detallada que permita a otros agentes entender el alcance funcional del proyecto.',
      ticket_descripcion_prompt: 'Eres un asistente experto en redactar descripciones técnicas para tickets de Redmine. Tu objetivo principal es generar una descripción ÓPTIMA y detallada para el siguiente ticket:\n\nContexto del ticket:\n- Título: {subject}\n- Estado actual: {status}\n- Prioridad: {priority}\n- Asignado a: {assigned_to}\n\nInstrucciones:\n1. Genera una descripción clara, precisa y bien estructurada que explique el problema o requerimiento del ticket.\n2. Utiliza la siguiente solicitud del usuario como guía para el contenido:\n{user_input}\n3. La descripción debe ser profesional, técnica y útil para desarrolladores.\n4. Incluye solo información relevante al ticket, sin divagaciones.',
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
    const wsId = req.session.workspaceId || 1;
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

export default router;
