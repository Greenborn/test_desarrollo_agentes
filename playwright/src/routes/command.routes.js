import { Router } from 'express';
import browserManager from '../services/browserManager.js';

const router = Router();

router.post('/command', async (req, res) => {
  try {
    const { comando, parametros } = req.body;

    if (!comando) {
      return res.status(400).json({ error: 'Campo "comando" es requerido' });
    }

    if (comando === 'start') {
      const navegador = parametros?.navegador;
      if (!navegador) {
        return res.status(400).json({ error: 'Parámetro "navegador" es requerido' });
      }

      try {
        const idSession = await browserManager.startSession(navegador);
        return res.json({ id_session: idSession });
      } catch (err) {
        return res.status(500).json({ error: err.message });
      }
    }

    if (comando === 'go_to_url') {
      const idSession = parametros?.id_session;
      const url = parametros?.url;

      if (!idSession || !url) {
        return res.status(400).json({ error: 'Parámetros "id_session" y "url" son requeridos' });
      }

      try {
        await browserManager.goToUrl(idSession, url);
        return res.json({ success: true });
      } catch (err) {
        return res.status(500).json({ error: err.message });
      }
    }

    return res.status(400).json({ error: `Comando desconocido: "${comando}"` });
  } catch (err) {
    console.log('Error en /api/command:', err.message);
    return res.status(500).json({ error: err.message });
  }
});

export default router;
