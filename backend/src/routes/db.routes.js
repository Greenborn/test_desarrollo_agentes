import { Router } from 'express';
import { execSync } from 'child_process';
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

router.post('/export', async (req, res) => {
  if (!authGuard(req, res)) return;
  try {
    const { output } = req.body;

    const host = process.env.DB_HOST;
    const port = process.env.DB_PORT;
    const user = process.env.DB_USER;
    const password = process.env.DB_PASSWORD;
    const database = process.env.DB_NAME;

    if (!host || !port || !user || !password || !database) {
      throw new Error('Faltan credenciales de base de datos en .env');
    }

    const dumpCmd = `mysqldump --single-transaction --routines --triggers --events -h ${host} -P ${port} -u ${user} -p${password} ${database}`;

    const dump = execSync(dumpCmd, { encoding: 'utf-8', maxBuffer: 500 * 1024 * 1024 });

    const absPath = output ? path.resolve(output) : path.join(EXPORTS_DIR, `db_export_${Date.now()}.sql`);
    const dir = path.dirname(absPath);
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true });
    }
    fs.writeFileSync(absPath, dump, 'utf-8');
    res.json({ success: true, result: `Base de datos exportada a: ${absPath}` });
  } catch (err) {
    console.log('Error al exportar base de datos:', err.message);
    res.status(500).json({ success: false, error: err.message });
  }
});

export default router;
