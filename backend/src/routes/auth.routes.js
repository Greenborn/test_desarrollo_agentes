import { Router } from 'express';
import bcrypt from 'bcrypt';
import db from '../config/db.js';
import memoriaClient from '../services/memoriaClient.js';

const router = Router();

function getUser(req) {
  const userId = req.session?.userId;
  if (!userId) return null;
  return { id: userId, username: req.session.username, role: req.session.role, workspaceIds: req.session.workspaceIds || [1] };
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
    const userWs = await db('user_settings').where({ user_id: user.id, key: 'selected_workspace_id' }).first();
    let wsIds = [1];
    if (userWs) {
      try {
        const parsed = JSON.parse(userWs.value);
        wsIds = Array.isArray(parsed) ? parsed : [parseInt(userWs.value, 10) || 1];
      } catch (err) { console.log('[auth] Error al parsear workspaceIds:', err.message);
        wsIds = [parseInt(userWs.value, 10) || 1];
      }
    }
    req.session.workspaceIds = wsIds;
    await new Promise((resolve) => req.session.save(resolve));
    res.json({
      success: true,
      user: { id: user.id, username: user.username, role: user.role, workspaceIds: wsIds },
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

router.post('/apply-session', async (req, res) => {
  try {
    const { sessionToken } = req.body;
    if (!sessionToken) {
      return res.status(400).json({ success: false, error: 'sessionToken requerido' });
    }
    const data = await memoriaClient.get('session', sessionToken);
    if (!data || !data.value) {
      return res.status(401).json({ success: false, error: 'Sesión no válida' });
    }
    req.session.userId = data.value.userId;
    req.session.username = data.value.username;
    req.session.role = data.value.role;
    req.session.workspaceIds = data.value.workspaceIds || [1];
    req.session._token = sessionToken;
    await new Promise((resolve) => req.session.save(resolve));
    res.cookie('session_token', sessionToken, {
      httpOnly: true,
      secure: false,
      sameSite: 'lax',
      path: '/',
      domain: 'localhost',
      maxAge: 86400 * 1000,
    });
    res.json({ success: true, user: { id: data.value.userId, username: data.value.username, role: data.value.role, workspaceIds: data.value.workspaceIds || [1] } });
  } catch (err) {
    console.log('Error en apply-session:', err.message);
    res.status(500).json({ success: false, error: 'Error interno' });
  }
});

export default router;
