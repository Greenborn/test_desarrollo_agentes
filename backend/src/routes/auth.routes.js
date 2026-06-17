import { Router } from 'express';
import bcrypt from 'bcrypt';
import db from '../config/db.js';

const router = Router();

function getUser(req) {
  const userId = req.session?.userId;
  if (!userId) return null;
  return { id: userId, username: req.session.username, role: req.session.role, workspaceId: req.session.workspaceId || 1 };
}

router.get('/me', (req, res) => {
  res.json(getUser(req));
});

router.post('/login', async (req, res) => {
  try {
    const { username, password } = req.body;
    const users = await db('users').where({ username });
    if (!users.length) {
      return res.status(401).json({ success: false, error: 'Credenciales inválidas' });
    }
    const user = users[0];
    const match = await bcrypt.compare(password, user.password_hash);
    if (!match) {
      return res.status(401).json({ success: false, error: 'Credenciales inválidas' });
    }
    req.session.userId = user.id;
    req.session.username = user.username;
    req.session.role = user.role;
    req.session.workspaceId = 1;
    await new Promise((resolve) => req.session.save(resolve));
    res.json({
      success: true,
      user: { id: user.id, username: user.username, role: user.role },
    });
  } catch (err) {
    console.log('Error en login:', err.message);
    res.status(500).json({ success: false, error: 'Error interno' });
  }
});

router.post('/logout', (req, res) => {
  req.session.destroy(() => {
    res.json({ success: true });
  });
});

export default router;
