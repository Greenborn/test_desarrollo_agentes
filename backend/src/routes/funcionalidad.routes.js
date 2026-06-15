import { Router } from 'express';
import db from '../config/db.js';

const router = Router();

function authGuard(req, res) {
  if (!req.session?.userId) {
    res.status(401).json({ error: 'Sesión no válida' });
    return false;
  }
  return true;
}

router.get('/funcionalidad/:sessionId', async (req, res) => {
  if (!authGuard(req, res)) return;
  try {
    const row = await db('funcionalidades').where({ session_id: req.params.sessionId }).first();
    if (row && row.parametros) {
      try {
        row.parametros = JSON.parse(row.parametros);
      } catch {
        row.parametros = {};
      }
    }
    res.json({ funcionalidad: row || null });
  } catch (err) {
    console.log('Error al obtener funcionalidad:', err.message);
    res.status(500).json({ funcionalidad: null, error: err.message });
  }
});

router.post('/funcionalidad', async (req, res) => {
  if (!authGuard(req, res)) return;
  const { sessionId, etapa, parametros } = req.body;

  if (!sessionId) {
    return res.status(400).json({ error: 'sessionId es requerido' });
  }

  try {
    const existing = await db('funcionalidades').where({ session_id: sessionId }).first();

    const data = {
      session_id: sessionId,
      etapa: etapa || 'RELEVAMIENTO',
      parametros: parametros ? JSON.stringify(parametros) : null,
      fecha_hora: db.fn.now(),
    };

    if (existing) {
      await db('funcionalidades').where({ session_id: sessionId }).update(data);
    } else {
      await db('funcionalidades').insert(data);
    }

    await db('chat_sessions').where({ id: sessionId }).update({ updated_at: db.fn.now() });

    const saved = await db('funcionalidades').where({ session_id: sessionId }).first();
    if (saved && saved.parametros) {
      try {
        saved.parametros = JSON.parse(saved.parametros);
      } catch {
        saved.parametros = {};
      }
    }

    res.status(existing ? 200 : 201).json({ success: true, funcionalidad: saved });
  } catch (err) {
    console.log('Error al guardar funcionalidad:', err.message);
    res.status(500).json({ success: false, error: err.message });
  }
});

router.delete('/funcionalidad/:sessionId', async (req, res) => {
  if (!authGuard(req, res)) return;
  try {
    await db('funcionalidades').where({ session_id: req.params.sessionId }).del();
    await db('chat_sessions').where({ id: req.params.sessionId }).update({ updated_at: db.fn.now() });
    res.json({ success: true });
  } catch (err) {
    console.log('Error al eliminar funcionalidad:', err.message);
    res.status(500).json({ success: false, error: err.message });
  }
});

export default router;
