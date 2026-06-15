import { Router } from 'express';
import knex from 'knex';

const required = ['DB_HOST', 'DB_PORT', 'DB_USER', 'DB_PASSWORD', 'DB_NAME'];
for (const key of required) {
  if (!process.env[key]) {
    console.log(`Falta ${key} en .env`);
    process.exit(1);
  }
}

const db = knex({
  client: 'mysql2',
  connection: {
    host: process.env.DB_HOST,
    port: parseInt(process.env.DB_PORT),
    user: process.env.DB_USER,
    password: process.env.DB_PASSWORD,
    database: process.env.DB_NAME,
  },
});

const TABLA = 'gastos_tokens_usados';

const router = Router();

router.get('/', async (req, res) => {
  try {
    const { id_proyecto, id_chat_session, id_sesion_opencode } = req.query;
    const query = db(TABLA).orderBy('fecha_hora', 'desc');

    if (id_proyecto) {
      query.where({ id_proyecto });
    }
    if (id_chat_session) {
      query.where({ id_chat_session: parseInt(id_chat_session) });
    }
    if (id_sesion_opencode) {
      query.where({ id_sesion_opencode });
    }

    const rows = await query;
    res.json(rows);
  } catch (err) {
    console.log('Error al obtener gastos:', err.message);
    res.status(500).json({ error: err.message });
  }
});

router.post('/register', async (req, res) => {
  try {
    const { id_chat_session, id_proyecto, precio, tokens, id_sesion_opencode } = req.body;

    if (id_chat_session === undefined || id_chat_session === null) {
      return res.status(400).json({ error: 'Campo "id_chat_session" es requerido' });
    }
    if (!id_proyecto) {
      return res.status(400).json({ error: 'Campo "id_proyecto" es requerido' });
    }
    if (precio === undefined || precio === null) {
      return res.status(400).json({ error: 'Campo "precio" es requerido' });
    }
    if (tokens === undefined || tokens === null) {
      return res.status(400).json({ error: 'Campo "tokens" es requerido' });
    }

    if (id_sesion_opencode) {
      const existing = await db(TABLA).where({ id_sesion_opencode }).first();
      if (existing) {
        await db(TABLA).where({ id_sesion_opencode }).update({
          precio: db.raw('precio + ?', [precio]),
          tokens: db.raw('tokens + ?', [tokens]),
        });
        return res.json({ success: true, id: existing.id, updated: true });
      }
    }

    const [id] = await db(TABLA).insert({
      id_chat_session,
      id_proyecto,
      precio,
      tokens,
      id_sesion_opencode: id_sesion_opencode || null,
    });

    res.json({ success: true, id });
  } catch (err) {
    console.log('Error al registrar gasto:', err.message);
    res.status(500).json({ error: err.message });
  }
});

export default router;
