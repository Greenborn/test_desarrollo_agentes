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

const TABLAS = {
  base_datos: 'documentacion_base_datos',
  subproyectos: 'documentacion_subproyectos',
  endpoints: 'documentacion_endpoints',
  web_sockets: 'documentacion_web_sockets',
  funcionalidades: 'documentacion_funcionalidades',
};

const router = Router();

router.get('/:proyectoId', async (req, res) => {
  try {
    const { proyectoId } = req.params;

    const result = {};
    for (const [key, table] of Object.entries(TABLAS)) {
      const rows = await db(table).where({ id_proyecto: proyectoId }).orderBy('id');
      result[key] = rows;
    }

    res.json(result);
  } catch (err) {
    console.log('Error al obtener documentación:', err.message);
    res.status(500).json({ error: err.message });
  }
});

export default router;
