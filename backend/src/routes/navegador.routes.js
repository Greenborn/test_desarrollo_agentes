import { Router } from 'express';

const router = Router();
const PW_URL = `http://localhost:${process.env.SERVICIO_PLAYWRIGHT_PORT || 4098}`;

router.post('/command', async (req, res) => {
  try {
    const pwRes = await fetch(`${PW_URL}/api/command`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(req.body),
    });
    const data = await pwRes.json();
    res.status(pwRes.status).json(data);
  } catch (err) {
    console.log('Error al conectar con servicio playwright:', err.message);
    res.status(502).json({ error: 'Error al conectar con el servicio de navegador' });
  }
});

export default router;
