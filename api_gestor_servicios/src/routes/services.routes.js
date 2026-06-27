import { Router } from 'express';
import { getProcess, isRunning, restartService, getServiceConfig } from '../index.js';

const router = Router();

router.get('/services', (req, res) => {
  const config = getServiceConfig();
  const services = Object.keys(config).map((name) => ({
    name,
    port: config[name].port ? parseInt(config[name].port, 10) : null,
    running: isRunning(name),
  }));

  res.json({ services });
});

router.post('/services/restart-all', (req, res) => {
  const config = getServiceConfig();
  const results = [];

  for (const name of Object.keys(config)) {
    if (name === 'memoria') continue;
    try {
      restartService(name);
      const running = isRunning(name);
      results.push({ name, success: true, running });
    } catch (err) {
      console.log(`[gestor] Error al reiniciar ${name}:`, err.message);
      results.push({ name, success: false, error: err.message });
    }
  }

  res.json({ success: true, results });
});

router.post('/services/:name/restart', (req, res) => {
  const { name } = req.params;

  const config = getServiceConfig();
  if (!config[name]) {
    return res.status(404).json({ error: `Servicio "${name}" no encontrado` });
  }

  try {
    restartService(name);
    const running = isRunning(name);
    res.json({ success: true, message: `Servicio "${name}" reiniciado`, running });
  } catch (err) {
    console.log(`[gestor] Error al reiniciar ${name}:`, err.message);
    res.status(500).json({ error: `Error al reiniciar "${name}": ${err.message}` });
  }
});

export default router;
