import { Router } from 'express';
import fs from 'fs';
import path from 'path';
import db from '../config/db.js';

const router = Router();

function authGuard(req, res) {
  if (!req.session?.userId) {
    res.status(401).json({ error: 'Sesión no válida' });
    return false;
  }
  return true;
}

router.get('/list-directories', async (req, res) => {
  if (!authGuard(req, res)) return;
  try {
    const prefix = req.query.prefix !== undefined && req.query.prefix !== '' ? req.query.prefix : '/';
    const dir = path.dirname(prefix);

    const entries = fs.readdirSync(dir, { withFileTypes: true });
    const dirs = entries
      .filter((e) => e.isDirectory())
      .map((e) => path.join(dir, e.name))
      .filter((p) => p.startsWith(prefix));

    res.json({ directories: dirs });
  } catch (err) {
    console.log('Error en list-directories:', err.message);
    res.json({ directories: [] });
  }
});

router.get('/setting/:key', async (req, res) => {
  if (!authGuard(req, res)) return;
  try {
    const row = await db('user_settings')
      .where({ user_id: req.session.userId, key: req.params.key })
      .first();
    res.json({ value: row ? row.value : null });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.post('/setting', async (req, res) => {
  if (!authGuard(req, res)) return;
  try {
    const { key, value } = req.body;
    await db('user_settings')
      .insert({ user_id: req.session.userId, key, value })
      .onConflict(['user_id', 'key'])
      .merge();
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.get('/history', async (req, res) => {
  if (!authGuard(req, res)) return;
  try {
    const rows = await db('command_history')
      .where({ user_id: req.session.userId })
      .orderBy('created_at', 'desc')
      .limit(50)
      .select('command', 'created_at');
    res.json({ history: rows });
  } catch (err) {
    res.status(500).json({ history: [], error: err.message });
  }
});

router.post('/history', async (req, res) => {
  if (!authGuard(req, res)) return;
  try {
    const { command } = req.body;
    await db('command_history').insert({ user_id: req.session.userId, command });
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

router.post('/execute', async (req, res) => {
  if (!authGuard(req, res)) return;
  const { command, sessionId } = req.body;
  if (!command) return res.status(400).json({ error: 'Comando requerido' });

  try {
    const parts = command.trim().split(/\s+/);
    const cmd = parts[0].toLowerCase();
    const args = parts.slice(1);

    let result = '';

    if (cmd === '/cd') {
      const dir = args.join(' ');
      if (!dir) {
        result = 'Error: debe especificar un directorio';
      } else {
        let resolved;
        if (dir.startsWith('~')) {
          resolved = process.env.HOME ? dir.replace(/^~/, process.env.HOME) : dir;
        } else {
          resolved = path.resolve(dir);
        }
        if (!fs.existsSync(resolved)) {
          result = `Error: el directorio '${resolved}' no existe`;
        } else if (!fs.statSync(resolved).isDirectory()) {
          result = `Error: '${resolved}' no es un directorio`;
        } else {
          await db('user_settings')
            .insert({ user_id: req.session.userId, key: 'last_directory', value: resolved })
            .onConflict(['user_id', 'key'])
            .merge();
          result = resolved;
        }
      }
    } else if (cmd === '/help') {
      result = 'Comando recibido — el modal de ayuda se muestra en cliente';
    } else if (cmd === '/history') {
      const rows = await db('command_history')
        .where({ user_id: req.session.userId })
        .orderBy('created_at', 'desc')
        .limit(20)
        .select('command', 'created_at');
      const formatted = rows.map((r) => `${r.created_at}: ${r.command}`).join('\n');
      result = formatted ? formatted : '(sin historial)';
    } else {
      result = `Error: comando desconocido '${cmd}'`;
    }

    if (sessionId) {
      await db('chat_messages').insert({ session_id: sessionId, role: 'command', content: command });
      await db('chat_messages').insert({ session_id: sessionId, role: 'result', content: result });
      await db('chat_sessions').where({ id: sessionId }).update({ updated_at: db.fn.now() });
    }

    await db('command_history').insert({ user_id: req.session.userId, command });

    const success = !result.startsWith('Error:');
    res.json({ success, result, command });
  } catch (err) {
    console.log('Error al ejecutar comando:', err.message);
    const errorResult = `Error: ${err.message}`;
    if (sessionId) {
      try {
        await db('chat_messages').insert({ session_id: sessionId, role: 'command', content: command });
        await db('chat_messages').insert({ session_id: sessionId, role: 'result', content: errorResult });
      } catch (innerErr) {
        console.log('Error al guardar resultado de error en chat_messages:', innerErr.message);
      }
    }
    res.status(500).json({ success: false, result: errorResult, command });
  }
});

export default router;
