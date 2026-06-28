import { Router } from 'express';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import db from '../config/db.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const STORAGE_DIR = path.resolve(__dirname, '../../../uploads/archivos');

const router = Router();

function authGuard(req, res) {
  if (!req.session?.userId) {
    res.status(401).json({ error: 'Sesión no válida' });
    return false;
  }
  return true;
}

function ensureStorageDir() {
  if (!fs.existsSync(STORAGE_DIR)) {
    fs.mkdirSync(STORAGE_DIR, { recursive: true });
  }
}

router.get('/', async (req, res) => {
  if (!authGuard(req, res)) return;
  try {
    const { proyecto_id, chat_session_id, tipo } = req.query;
    let query = db('archivos').orderBy('created_at', 'desc');
    if (proyecto_id) {
      query = query.where({ proyecto_id });
    }
    if (chat_session_id) {
      query = query.where({ chat_session_id });
    }
    if (tipo) {
      query = query.where({ tipo });
    }
    const archivos = await query.select('*');
    res.json({ archivos });
  } catch (err) {
    console.log('Error al listar archivos:', err.message);
    res.status(500).json({ archivos: [], error: err.message });
  }
});

router.get('/:id/download', async (req, res) => {
  if (!authGuard(req, res)) return;
  try {
    const archivo = await db('archivos').where({ id: req.params.id }).first();
    if (!archivo) {
      return res.status(404).json({ error: 'Archivo no encontrado' });
    }
    const filePath = path.join(STORAGE_DIR, archivo.nombre_storage);
    if (!fs.existsSync(filePath)) {
      return res.status(404).json({ error: 'El archivo no existe en el disco' });
    }
    res.sendFile(filePath);
  } catch (err) {
    console.log('Error al descargar archivo:', err.message);
    res.status(500).json({ error: err.message });
  }
});

router.get('/:id/metadata', async (req, res) => {
  if (!authGuard(req, res)) return;
  try {
    const archivo = await db('archivos').where({ id: req.params.id }).first();
    if (!archivo) {
      return res.status(404).json({ error: 'Archivo no encontrado' });
    }
    const metadata = await db('capturas_metadata')
      .where({ archivo_id: req.params.id })
      .orderBy('created_at', 'asc')
      .select('*');
    res.json({ metadata });
  } catch (err) {
    console.log('Error al listar metadata:', err.message);
    res.status(500).json({ metadata: [], error: err.message });
  }
});

router.post('/:id/metadata', async (req, res) => {
  if (!authGuard(req, res)) return;
  try {
    const archivo = await db('archivos').where({ id: req.params.id }).first();
    if (!archivo) {
      return res.status(404).json({ error: 'Archivo no encontrado' });
    }
    const { key, value } = req.body;
    if (!key || value === undefined || value === null) {
      return res.status(400).json({ error: 'key y value son requeridos' });
    }
    const existing = await db('capturas_metadata')
      .where({ archivo_id: req.params.id, key })
      .first();
    if (existing) {
      await db('capturas_metadata')
        .where({ id: existing.id })
        .update({ value, created_at: db.fn.now() });
    } else {
      await db('capturas_metadata').insert({
        archivo_id: req.params.id,
        key,
        value,
      });
    }
    const record = await db('capturas_metadata')
      .where({ archivo_id: req.params.id, key })
      .first();
    res.json({ metadata: record });
  } catch (err) {
    console.log('Error al guardar metadata:', err.message);
    res.status(500).json({ error: err.message });
  }
});

router.delete('/:id/metadata/:mid', async (req, res) => {
  if (!authGuard(req, res)) return;
  try {
    const archivo = await db('archivos').where({ id: req.params.id }).first();
    if (!archivo) {
      return res.status(404).json({ error: 'Archivo no encontrado' });
    }
    const deleted = await db('capturas_metadata')
      .where({ id: req.params.mid, archivo_id: req.params.id })
      .del();
    if (!deleted) {
      return res.status(404).json({ error: 'Metadata no encontrada' });
    }
    res.json({ success: true });
  } catch (err) {
    console.log('Error al eliminar metadata:', err.message);
    res.status(500).json({ success: false, error: err.message });
  }
});

router.delete('/:id', async (req, res) => {
  if (!authGuard(req, res)) return;
  try {
    const archivo = await db('archivos').where({ id: req.params.id }).first();
    if (!archivo) {
      return res.status(404).json({ error: 'Archivo no encontrado' });
    }
    const filePath = path.join(STORAGE_DIR, archivo.nombre_storage);
    try {
      if (fs.existsSync(filePath)) {
        fs.unlinkSync(filePath);
      }
    } catch (fsErr) {
      console.log('Error al eliminar archivo del disco:', fsErr.message);
    }
    await db('archivos').where({ id: req.params.id }).del();
    res.json({ success: true });
  } catch (err) {
    console.log('Error al eliminar archivo:', err.message);
    res.status(500).json({ success: false, error: err.message });
  }
});

export { STORAGE_DIR, ensureStorageDir };
export default router;
