import { execSync } from 'child_process';
import db from '../config/db.js';

export async function fetchAllSessionRepos() {
  console.log('[git-fetch] Iniciando actualización de repositorios de sesiones de chat...');
  try {
    const rows = await db('chat_sessions')
      .select('cwd')
      .whereNotNull('cwd')
      .where('cwd', '!=', '')
      .distinct();

    const dirs = rows.map(r => r.cwd).filter(Boolean);
    if (dirs.length === 0) {
      console.log('[git-fetch] No hay sesiones con directorio configurado.');
      return;
    }

    for (const dir of dirs) {
      try {
        const rootPath = execSync('git rev-parse --show-toplevel', {
          cwd: dir,
          encoding: 'utf-8',
          timeout: 5000,
        }).trim();

        console.log(`[git-fetch] Ejecutando git fetch en: ${rootPath}`);
        execSync('git fetch', {
          cwd: rootPath,
          encoding: 'utf-8',
          timeout: 30000,
          env: { ...process.env, GIT_PAGER: 'cat', PAGER: 'cat' },
        });
        console.log(`[git-fetch] ✓ ${rootPath}`);
      } catch (err) {
        if (err.status === 128 || (err.stderr && err.stderr.toString().includes('not a git repository'))) {
          console.log(`[git-fetch] ✗ ${dir} no es un repositorio git`);
        } else {
          console.log(`[git-fetch] ✗ Error en ${dir}: ${err.message}`);
        }
      }
    }

    console.log('[git-fetch] Actualización completada.');
  } catch (err) {
    console.log('[git-fetch] Error al consultar sesiones:', err.message);
  }
}
