import { Router } from 'express';
import { getRedmineToken, getRedmineUrl } from '../services/redmine.js';

const router = Router();

function authGuard(req, res) {
  if (!req.session?.userId) {
    res.status(401).json({ error: 'Sesión no válida' });
    return false;
  }
  return true;
}

router.post('/test', async (req, res) => {
  if (!authGuard(req, res)) return;

  try {
    const token = await getRedmineToken();
    const url = await getRedmineUrl();

    if (!token || !url) {
      res.json({
        success: false,
        message: 'Token o URL de Redmine no configurados. Configure ambos en Configuración.',
      });
      return;
    }

    const apiUrl = url.replace(/\/+$/, '') + '/projects.json';

    const response = await fetch(apiUrl, {
      headers: {
        Authorization: `Bearer ${token}`,
        'Content-Type': 'application/json',
      },
    });

    if (response.ok) {
      res.json({ success: true, message: 'Conexión exitosa a Redmine.' });
    } else {
      const text = await response.text();
      res.json({
        success: false,
        message: `Error de conexión: HTTP ${response.status}${text ? ' — ' + text.slice(0, 200) : ''}`,
      });
    }
  } catch (err) {
    console.log('Error al probar conexión Redmine:', err.message);
    res.json({ success: false, message: 'Error al conectar con Redmine: ' + err.message });
  }
});

export default router;
