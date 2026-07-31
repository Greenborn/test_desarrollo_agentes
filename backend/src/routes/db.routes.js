import { Router } from 'express';
import fs from 'fs';
import path from 'path';
import { execSync } from 'child_process';
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

router.post('/backup', async (req, res) => {
  if (!authGuard(req, res)) return;
  try {
    const wsIds = req.session.workspaceIds || [1];
    const wsId = req.query.workspace_id ? parseInt(req.query.workspace_id, 10) : wsIds[0] || 1;
    const { all, upload } = req.body;

    const dataDir = path.resolve(__dirname, '../../../data');
    const timestamp = Date.now();
    const backupDir = path.join(EXPORTS_DIR, `backup_${timestamp}`);
    fs.mkdirSync(backupDir, { recursive: true });

    const files = all
      ? fs.readdirSync(dataDir).filter(f => f.endsWith('.db'))
      : [path.basename(getSqlitePath())];

    if (files.length === 0) {
      throw new Error('No se encontraron archivos de base de datos para respaldar');
    }

    for (const file of files) {
      const src = path.join(dataDir, file);
      if (fs.existsSync(src)) {
        fs.copyFileSync(src, path.join(backupDir, file));
      }
    }

    const zipName = `backup_${timestamp}.zip`;
    const zipPath = path.join(EXPORTS_DIR, zipName);
    execSync(`zip -j "${zipPath}" "${backupDir}"/*.db`, { stdio: 'pipe', timeout: 60000 });

    fs.rmSync(backupDir, { recursive: true, force: true });

    let uploadResult = null;
    let uploadError = null;
    const requestLogs = [];
    if (upload) {
      try {
        const internalKey = process.env.INTERNAL_API_KEY || 'internal_gestor_key';
        const fileBase64 = fs.readFileSync(zipPath, { encoding: 'base64' });
        const backendPort = process.env.PORT || 4000;
        const uploadRes = await fetch(`http://localhost:${backendPort}/api/gestion/upload`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'X-Internal-Key': internalKey,
          },
          body: JSON.stringify({
            nombre_original: zipName,
            mime_type: 'application/zip',
            base64: fileBase64,
            workspace_id: wsId,
          }),
        });
        const uploadData = await uploadRes.json();
        if (uploadData.success) {
          uploadResult = uploadData.data;
          if (uploadData.requestLogs) requestLogs.push(...uploadData.requestLogs);
        } else {
          uploadError = uploadData.message || 'Error al subir a gestión interna';
          if (uploadData.requestLog) requestLogs.push(uploadData.requestLog);
        }
      } catch (uploadErr) {
        uploadError = uploadErr.message;
        console.log('[backup] Error al subir a gestión:', uploadErr.message);
      }
    }

    const resultMsg = upload
      ? uploadResult
        ? `Backup creado y subido a gestión interna: ${zipPath}`
        : `Backup creado pero no se pudo subir a gestión interna: ${uploadError || 'error desconocido'}: ${zipPath}`
      : `Backup creado: ${zipPath}`;

    res.json({
      success: true,
      result: resultMsg,
      zipPath,
      uploaded: !!uploadResult,
      uploadError,
      uploadData: uploadResult,
      requestLogs,
    });
  } catch (err) {
    console.log('Error al hacer backup:', err.message);
    res.status(500).json({ success: false, error: err.message });
  }
});

export default router;
