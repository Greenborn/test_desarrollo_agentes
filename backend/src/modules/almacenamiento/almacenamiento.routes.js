import { Router } from 'express';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { buildTree, countTreeFiles } from '../../services/fileTreeBuilder.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

const STORAGE_DIR = process.env.ALMACENAMIENTO_DIR
  ? path.resolve(process.env.ALMACENAMIENTO_DIR)
  : path.resolve(__dirname, '../../../../almacenamiento');

function ensureStorageDir() {
  if (!fs.existsSync(STORAGE_DIR)) {
    fs.mkdirSync(STORAGE_DIR, { recursive: true });
  }
}

ensureStorageDir();

export function getAlmacenamientoDir() {
  ensureStorageDir();
  return STORAGE_DIR;
}

// Confina `dir` (relativo o absoluto) dentro de STORAGE_DIR. Este directorio es alcanzable
// también desde el sistema de gestión interno remoto, a diferencia de `arbol-directorios`
// (sessionId) no corresponde dejarlo sin confinamiento.
export function resolveConfinedPath(dir) {
  const base = getAlmacenamientoDir();
  const target = dir ? path.resolve(base, dir) : base;
  const realBase = fs.realpathSync(base);
  let realTarget;
  try {
    realTarget = fs.realpathSync(target);
  } catch (err) {
    realTarget = target;
  }
  if (realTarget !== realBase && !realTarget.startsWith(realBase + path.sep)) {
    return null;
  }
  return target;
}

const router = Router();

function authGuard(req, res) {
  if (!req.session?.userId) {
    res.status(401).json({ success: false, error: 'Sesión no válida' });
    return false;
  }
  return true;
}

router.get('/arbol', async (req, res) => {
  if (!authGuard(req, res)) return;
  try {
    const dirArg = req.query.dir || '';
    const useGitignore = req.query.useGitignore === 'true';
    const showHidden = req.query.showHidden !== 'false';
    const depth = parseInt(req.query.depth, 10) || 0;

    const targetDir = resolveConfinedPath(dirArg);
    if (!targetDir) {
      return res.status(400).json({ success: false, error: 'Ruta fuera del directorio de almacenamiento' });
    }
    if (!fs.existsSync(targetDir)) {
      return res.status(400).json({ success: false, error: `El directorio '${targetDir}' no existe` });
    }
    if (!fs.statSync(targetDir).isDirectory()) {
      return res.status(400).json({ success: false, error: `'${targetDir}' no es un directorio` });
    }

    const tree = await buildTree(targetDir, [], useGitignore, showHidden, undefined, depth);
    const totalFiles = countTreeFiles(tree);
    res.json({ success: true, tree, totalFiles });
  } catch (err) {
    console.log('Error en almacenamiento/arbol:', err.message);
    res.status(500).json({ success: false, error: err.message });
  }
});

export default router;
