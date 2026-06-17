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

router.get('/', async (req, res) => {
  if (!authGuard(req, res)) return;

  try {
    const tickets = await db('tickets')
      .select('*')
      .orderBy('redmine_updated_on', 'desc');

    res.json({ success: true, tickets });
  } catch (err) {
    console.log('Error al listar tickets:', err.message);
    res.status(500).json({ error: err.message });
  }
});

export default router;
