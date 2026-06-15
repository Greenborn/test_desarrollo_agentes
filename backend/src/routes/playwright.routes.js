import { Router } from 'express';
import playwrightManager from '../services/playwrightManager.js';

const router = Router();

router.post('/command', async (req, res) => {
  const { comando, parametros } = req.body;

  if (!comando) {
    return res.status(400).json({ error: 'Campo "comando" es requerido' });
  }

  try {
    await playwrightManager.ensureRunning();
    playwrightManager.startKeepAlive();

    const response = await fetch(`${playwrightManager.baseUrl()}/api/command`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ comando, parametros }),
    });
    const data = await response.json();
    return res.status(response.status).json(data);
  } catch (err) {
    console.log('Error al comunicar con servicio Playwright:', err.message);
    return res.status(500).json({ error: `Error de conexión con Playwright: ${err.message}` });
  }
});

export default router;
