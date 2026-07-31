import { Router } from 'express';
import { login, uploadFile, getGestionCredentials, testConnection, listProyectos, exportProyecto } from './gestion.service.js';
import { slugify } from '../../utils/slugify.js';

const router = Router();

const INTERNAL_KEY = process.env.INTERNAL_API_KEY || 'internal_gestor_key';

function authGuard(req, res) {
  if (req.headers['x-internal-key'] === INTERNAL_KEY) {
    return true;
  }
  if (!req.session?.userId) {
    res.status(401).json({ error: 'No autorizado' });
    return false;
  }
  return true;
}

function getWsId(req) {
  if (req.headers['x-internal-key'] === INTERNAL_KEY) {
    return parseInt(req.query.workspace_id, 10) || parseInt(req.body?.workspace_id, 10) || 1;
  }
  const wsIds = req.session?.workspaceIds || [];
  return req.query.workspace_id ? parseInt(req.query.workspace_id, 10) : wsIds[0] || 1;
}

router.post('/test', async (req, res) => {
  if (!authGuard(req, res)) return;
  try {
    const wsId = getWsId(req);
    const result = await testConnection(wsId);
    res.json(result);
  } catch (err) {
    console.log('[gestion] Error en test:', err.message);
    res.status(500).json({ success: false, message: err.message });
  }
});

router.post('/login', async (req, res) => {
  if (!authGuard(req, res)) return;
  try {
    const wsId = getWsId(req);
    const creds = await getGestionCredentials(wsId);
    if (!creds) {
      return res.json({ success: false, message: 'Gestión interna no configurada.' });
    }
    const result = await login(creds.gestionUrl, creds.username, creds.password);
    res.json({ success: true, token: result.token, requestLog: result.requestLog });
  } catch (err) {
    console.log('[gestion] Error en login:', err.message);
    res.json({ success: false, message: err.message, requestLog: err.requestLog || null });
  }
});

router.post('/upload', async (req, res) => {
  if (!authGuard(req, res)) return;
  try {
    const { nombre_original, mime_type, base64, workspace_id } = req.body;
    if (!nombre_original || !mime_type || !base64) {
      return res.status(400).json({ success: false, error: 'nombre_original, mime_type y base64 son requeridos' });
    }
    const wsId = workspace_id || getWsId(req);
    const creds = await getGestionCredentials(wsId);
    if (!creds) {
      return res.json({ success: false, message: 'Gestión interna no configurada.' });
    }
    const loginResult = await login(creds.gestionUrl, creds.username, creds.password);
    const uploadResult = await uploadFile(creds.gestionUrl, loginResult.token, nombre_original, mime_type, base64);
    res.json({ success: true, data: uploadResult.data, requestLogs: [loginResult.requestLog, uploadResult.requestLog] });
  } catch (err) {
    console.log('[gestion] Error en upload:', err.message);
    res.json({ success: false, message: err.message, requestLog: err.requestLog || null });
  }
});

router.get('/status', async (req, res) => {
  if (!authGuard(req, res)) return;
  try {
    const wsId = getWsId(req);
    const creds = await getGestionCredentials(wsId);
    res.json({
      configured: !!creds,
      url: creds?.gestionUrl || null,
    });
  } catch (err) {
    console.log('[gestion] Error en status:', err.message);
    res.json({ configured: false, url: null });
  }
});

router.get('/proyectos', async (req, res) => {
  if (!authGuard(req, res)) return;
  try {
    const wsId = getWsId(req);
    const { proyectos, requestLog } = await listProyectos(wsId);
    const enriched = (proyectos || []).map((p) => ({
      ...p,
      slug: p.slug || slugify(p.nombre || p.name || p.descripcion || 'proyecto'),
    }));
    res.json({ success: true, proyectos: enriched, requestLog });
  } catch (err) {
    console.log('[gestion] Error al listar proyectos:', err.message);
    res.json({ success: false, message: err.message, requestLog: err.requestLog || null });
  }
});

router.post('/proyectos/exportar', async (req, res) => {
  if (!authGuard(req, res)) return;
  try {
    const { proyecto } = req.body;
    if (!proyecto || typeof proyecto !== 'object') {
      return res.status(400).json({ success: false, message: 'proyecto es requerido' });
    }
    const wsId = req.body.workspace_id || getWsId(req);
    const result = await exportProyecto(wsId, proyecto);
    res.json({ success: true, data: result.data, requestLog: result.requestLog });
  } catch (err) {
    console.log('[gestion] Error al exportar proyecto:', err.message);
    res.json({ success: false, message: err.message, requestLog: err.requestLog || null });
  }
});

export default router;
