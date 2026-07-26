import { Router } from 'express';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const EXPORTS_DIR = path.resolve(__dirname, '../../exports');

const router = Router();

function authGuard(req, res) {
  if (!req.session?.userId) {
    res.status(401).json({ error: 'Sesión no válida' });
    return false;
  }
  return true;
}

function getSqlitePath() {
  const envPath = process.env.DB_SQLITE_PATH;
  if (envPath) {
    return path.resolve(__dirname, '../../../', envPath);
  }
  return path.resolve(__dirname, '../../../data/app.db');
}

router.post('/export', async (req, res) => {
  if (!authGuard(req, res)) return;
  try {
    const { output } = req.body;

    const dbPath = getSqlitePath();
    if (!fs.existsSync(dbPath)) {
      throw new Error('Archivo SQLite no encontrado: ' + dbPath);
    }

    const absPath = output ? path.resolve(output) : path.join(EXPORTS_DIR, `db_export_${Date.now()}.db`);
    const dir = path.dirname(absPath);
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true });
    }
    fs.copyFileSync(dbPath, absPath);
    res.json({ success: true, result: `Base de datos exportada a: ${absPath}` });
  } catch (err) {
    console.log('Error al exportar base de datos:', err.message);
    res.status(500).json({ success: false, error: err.message });
  }
});

export default router;
