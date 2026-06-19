import { Router } from 'express';
import db from '../config/db.js';

const router = Router();
const MAX_CONTENT_SIZE = 10000;

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
    const rows = await db('templates').select('id', 'slug', 'created_at', 'updated_at').orderBy('slug', 'asc');
    res.json(rows);
  } catch (err) {
    console.log('Error al obtener plantillas:', err.message);
    res.status(500).json({ error: 'Error al obtener plantillas' });
  }
});

router.get('/:slug', async (req, res) => {
  if (!authGuard(req, res)) return;
  try {
    const row = await db('templates').where({ slug: req.params.slug }).first();
    if (!row) {
      res.status(404).json({ error: 'Plantilla no encontrada' });
      return;
    }
    res.json(row);
  } catch (err) {
    console.log('Error al obtener plantilla:', err.message);
    res.status(500).json({ error: 'Error al obtener plantilla' });
  }
});

router.post('/', async (req, res) => {
  if (!authGuard(req, res)) return;
  try {
    const { slug, content } = req.body;

    if (!slug || typeof slug !== 'string' || slug.trim().length === 0) {
      res.status(400).json({ error: 'El slug es requerido' });
      return;
    }
    if (!/^[a-zA-Z0-9_-]+$/.test(slug)) {
      res.status(400).json({ error: 'El slug solo puede contener letras, números, guiones y guiones bajos' });
      return;
    }
    if (slug.length > 100) {
      res.status(400).json({ error: 'El slug no puede exceder 100 caracteres' });
      return;
    }
    if (!content || typeof content !== 'string') {
      res.status(400).json({ error: 'El contenido es requerido' });
      return;
    }
    if (content.length > MAX_CONTENT_SIZE) {
      res.status(400).json({ error: `El contenido no puede exceder ${MAX_CONTENT_SIZE} caracteres` });
      return;
    }

    const [id] = await db('templates').insert({ slug: slug.trim(), content });
    res.status(201).json({ success: true, id });
  } catch (err) {
    if (err.code === 'ER_DUP_ENTRY') {
      res.status(409).json({ error: 'Ya existe una plantilla con ese slug' });
      return;
    }
    console.log('Error al crear plantilla:', err.message);
    res.status(500).json({ error: 'Error al crear plantilla' });
  }
});

router.put('/:slug', async (req, res) => {
  if (!authGuard(req, res)) return;
  try {
    const existing = await db('templates').where({ slug: req.params.slug }).first();
    if (!existing) {
      res.status(404).json({ error: 'Plantilla no encontrada' });
      return;
    }

    const { slug: newSlug, content } = req.body;
    const updateData = {};

    if (newSlug !== undefined) {
      if (typeof newSlug !== 'string' || newSlug.trim().length === 0) {
        res.status(400).json({ error: 'El slug no puede estar vacío' });
        return;
      }
      if (!/^[a-zA-Z0-9_-]+$/.test(newSlug)) {
        res.status(400).json({ error: 'El slug solo puede contener letras, números, guiones y guiones bajos' });
        return;
      }
      if (newSlug.length > 100) {
        res.status(400).json({ error: 'El slug no puede exceder 100 caracteres' });
        return;
      }
      updateData.slug = newSlug.trim();
    }

    if (content !== undefined) {
      if (typeof content !== 'string') {
        res.status(400).json({ error: 'El contenido debe ser texto' });
        return;
      }
      if (content.length > MAX_CONTENT_SIZE) {
        res.status(400).json({ error: `El contenido no puede exceder ${MAX_CONTENT_SIZE} caracteres` });
        return;
      }
      updateData.content = content;
    }

    if (Object.keys(updateData).length === 0) {
      res.status(400).json({ error: 'No hay campos para actualizar' });
      return;
    }

    updateData.updated_at = db.fn.now();

    await db('templates').where({ slug: req.params.slug }).update(updateData);
    res.json({ success: true });
  } catch (err) {
    if (err.code === 'ER_DUP_ENTRY') {
      res.status(409).json({ error: 'Ya existe otra plantilla con ese slug' });
      return;
    }
    console.log('Error al actualizar plantilla:', err.message);
    res.status(500).json({ error: 'Error al actualizar plantilla' });
  }
});

router.delete('/:slug', async (req, res) => {
  if (!authGuard(req, res)) return;
  try {
    const deleted = await db('templates').where({ slug: req.params.slug }).del();
    if (!deleted) {
      res.status(404).json({ error: 'Plantilla no encontrada' });
      return;
    }
    res.json({ success: true });
  } catch (err) {
    console.log('Error al eliminar plantilla:', err.message);
    res.status(500).json({ error: 'Error al eliminar plantilla' });
  }
});

export default router;
