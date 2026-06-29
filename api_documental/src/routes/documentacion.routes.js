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

// ------------------- NOTAS (key-value) -------------------
const MAX_VALOR_LENGTH = 16384;

router.get('/notas/:proyectoId', async (req, res) => {
  try {
    const { proyectoId } = req.params;
    if (!proyectoId) {
      return res.status(400).json({ error: 'proyectoId requerido' });
    }
    const rows = await db('documentacion_notas')
      .where({ id_proyecto: proyectoId })
      .orderBy('clave')
      .select('id', 'clave', 'id_ticket', 'created_at', 'updated_at');
    res.json(rows);
  } catch (err) {
    console.log('Error al listar notas:', err.message);
    res.status(500).json({ error: err.message });
  }
});

router.get('/notas/:proyectoId/:clave', async (req, res) => {
  try {
    const { proyectoId, clave } = req.params;
    if (!proyectoId || !clave) {
      return res.status(400).json({ error: 'proyectoId y clave requeridos' });
    }
    const row = await db('documentacion_notas')
      .where({ id_proyecto: proyectoId, clave })
      .first();
    if (!row) {
      return res.status(404).json({ error: 'Nota no encontrada' });
    }
    res.json(row);
  } catch (err) {
    console.log('Error al obtener nota:', err.message);
    res.status(500).json({ error: err.message });
  }
});

router.post('/notas', async (req, res) => {
  try {
    const { id_proyecto, clave, valor, id_ticket } = req.body;
    if (!id_proyecto) return res.status(400).json({ error: 'id_proyecto requerido' });
    if (!clave) return res.status(400).json({ error: 'clave requerida' });
    if (!id_ticket && id_ticket !== 0) return res.status(400).json({ error: 'id_ticket requerido' });
    if (!valor) return res.status(400).json({ error: 'valor requerido' });
    if (valor.length > MAX_VALOR_LENGTH) {
      return res.status(400).json({ error: `valor no puede exceder ${MAX_VALOR_LENGTH} caracteres` });
    }

    const [id] = await db('documentacion_notas').insert({ id_proyecto, clave, valor, id_ticket });
    const row = await db('documentacion_notas').where({ id }).first();
    res.status(201).json(row);
  } catch (err) {
    if (err.code === 'ER_DUP_ENTRY') {
      return res.status(409).json({ error: 'Ya existe una nota con esa clave en el proyecto' });
    }
    console.log('Error al crear nota:', err.message);
    res.status(500).json({ error: err.message });
  }
});

router.put('/notas/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const { clave, valor, id_ticket } = req.body;
    if (!clave) return res.status(400).json({ error: 'clave requerida' });
    if (!id_ticket && id_ticket !== 0) return res.status(400).json({ error: 'id_ticket requerido' });
    if (!valor) return res.status(400).json({ error: 'valor requerido' });
    if (valor.length > MAX_VALOR_LENGTH) {
      return res.status(400).json({ error: `valor no puede exceder ${MAX_VALOR_LENGTH} caracteres` });
    }

    const updated = await db('documentacion_notas')
      .where({ id })
      .update({ clave, valor, id_ticket, updated_at: db.fn.now() });
    if (!updated) {
      return res.status(404).json({ error: 'Nota no encontrada' });
    }
    const row = await db('documentacion_notas').where({ id }).first();
    res.json(row);
  } catch (err) {
    if (err.code === 'ER_DUP_ENTRY') {
      return res.status(409).json({ error: 'Ya existe una nota con esa clave en el proyecto' });
    }
    console.log('Error al actualizar nota:', err.message);
    res.status(500).json({ error: err.message });
  }
});

router.delete('/notas/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const deleted = await db('documentacion_notas').where({ id }).del();
    if (!deleted) {
      return res.status(404).json({ error: 'Nota no encontrada' });
    }
    res.json({ success: true });
  } catch (err) {
    console.log('Error al eliminar nota:', err.message);
    res.status(500).json({ error: err.message });
  }
});

// ------------------- LEGACY ENDPOINTS -------------------

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

router.get('/escaneo/ultimo/:sessionId', async (req, res) => {
  try {
    const row = await db('documentacion_escaneo')
      .where({ session_id: req.params.sessionId })
      .orderBy('fecha_hora_inicio', 'desc')
      .first();
    res.json(row ? { id: row.id } : { id: null });
  } catch (err) {
    console.log('Error al obtener último escaneo:', err.message);
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

router.delete('/archivo/por-escaneo/:escaneoId', async (req, res) => {
  try {
    await db('documentacion_archivo').where({ escaneo_id: req.params.escaneoId }).del();
    res.json({ success: true });
  } catch (err) {
    console.log('Error al limpiar archivos del escaneo:', err.message);
    res.status(500).json({ error: err.message });
  }
});

router.post('/archivo/batch', async (req, res) => {
  try {
    const { items } = req.body;
    if (!Array.isArray(items) || items.length === 0) {
      return res.status(400).json({ error: 'items debe ser un arreglo no vacío' });
    }

    for (const item of items) {
      if (!item.escaneo_id) return res.status(400).json({ error: 'escaneo_id requerido en cada item' });
      if (!item.nombre) return res.status(400).json({ error: 'nombre requerido en cada item' });
      if (!item.ruta) return res.status(400).json({ error: 'ruta requerida en cada item' });
    }

    const rows = items.map((item) => ({
      escaneo_id: item.escaneo_id,
      nombre: item.nombre,
      ruta: item.ruta,
      tipo: item.tipo || 'file',
      extension: item.extension || null,
      tamano: item.tamano || null,
      descripcion: item.descripcion || null,
    }));

    await db('documentacion_archivo').insert(rows);
    res.status(201).json({ inserted: rows.length });
  } catch (err) {
    console.log('Error al guardar batch de archivos:', err.message);
    res.status(500).json({ error: err.message });
  }
});

export default router;
