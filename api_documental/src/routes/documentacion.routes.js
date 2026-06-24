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

router.post('/escaneo/iniciar', async (req, res) => {
  try {
    const { session_id } = req.body;
    if (!session_id) return res.status(400).json({ error: 'session_id requerido' });

    const [id] = await db('documentacion_escaneo').insert({ session_id });
    const row = await db('documentacion_escaneo').where({ id }).first();
    res.status(201).json({ id, fecha_hora_inicio: row.fecha_hora_inicio });
  } catch (err) {
    console.log('Error al iniciar escaneo:', err.message);
    res.status(500).json({ error: err.message });
  }
});

router.put('/escaneo/:id/finalizar', async (req, res) => {
  try {
    const { id } = req.params;
    const { total_archivos, archivos_procesados } = req.body;

    await db('documentacion_escaneo')
      .where({ id })
      .update({
        fecha_hora_fin: db.fn.now(),
        total_archivos: total_archivos || 0,
        archivos_procesados: archivos_procesados || 0,
      });

    res.json({ success: true });
  } catch (err) {
    console.log('Error al finalizar escaneo:', err.message);
    res.status(500).json({ error: err.message });
  }
});

router.post('/archivo', async (req, res) => {
  try {
    const { escaneo_id, nombre, ruta, tipo, extension, tamano, descripcion } = req.body;
    if (!escaneo_id) return res.status(400).json({ error: 'escaneo_id requerido' });
    if (!nombre) return res.status(400).json({ error: 'nombre requerido' });
    if (!ruta) return res.status(400).json({ error: 'ruta requerida' });

    const [id] = await db('documentacion_archivo').insert({
      escaneo_id,
      nombre,
      ruta,
      tipo: tipo || 'file',
      extension: extension || null,
      tamano: tamano || null,
      descripcion: descripcion || null,
    });

    res.status(201).json({ id });
  } catch (err) {
    console.log('Error al guardar archivo:', err.message);
    res.status(500).json({ error: err.message });
  }
});

export default router;
