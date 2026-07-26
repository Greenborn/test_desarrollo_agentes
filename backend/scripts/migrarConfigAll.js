import 'dotenv/config';
import knex from 'knex';
import config from '../knexfile.js';
import { createDb } from '../src/config/dbFactory.js';

const TABLES = [
  { name: 'global_settings',          db: createDb('global_settings', 'DB_GLOBAL_SETTINGS_SQLITE_PATH') },
  { name: 'user_settings',            db: createDb('user_settings', 'DB_USER_SETTINGS_SQLITE_PATH') },
  { name: 'workspace_environments',   db: createDb('workspace_environments', 'DB_WORKSPACE_ENVIRONMENTS_SQLITE_PATH') },
  { name: 'templates',                db: createDb('templates', 'DB_TEMPLATES_SQLITE_PATH') },
  { name: 'project_variables',        db: createDb('project_variables', 'DB_PROJECT_VARIABLES_SQLITE_PATH') },
  { name: 'command_history',          db: createDb('command_history', 'DB_COMMAND_HISTORY_SQLITE_PATH') },
  { name: 'gastos_tokens_usados',     db: createDb('gastos', 'DB_GASTOS_SQLITE_PATH') },
  { name: 'playwright_network_logs',  db: createDb('playwright', 'DB_PLAYWRIGHT_SQLITE_PATH') },
  { name: 'playwright_console_logs',  db: createDb('playwright', 'DB_PLAYWRIGHT_SQLITE_PATH') },
  { name: 'playwright_events',        db: createDb('playwright', 'DB_PLAYWRIGHT_SQLITE_PATH') },
  { name: 'playwright_event_recordings', db: createDb('playwright', 'DB_PLAYWRIGHT_SQLITE_PATH') },
  { name: 'documentacion_base_datos', db: createDb('documentacion_content', 'DB_DOC_CONTENT_SQLITE_PATH') },
  { name: 'documentacion_subproyectos', db: createDb('documentacion_content', 'DB_DOC_CONTENT_SQLITE_PATH') },
  { name: 'documentacion_endpoints',  db: createDb('documentacion_content', 'DB_DOC_CONTENT_SQLITE_PATH') },
  { name: 'documentacion_web_sockets', db: createDb('documentacion_content', 'DB_DOC_CONTENT_SQLITE_PATH') },
  { name: 'documentacion_funcionalidades', db: createDb('documentacion_content', 'DB_DOC_CONTENT_SQLITE_PATH') },
  { name: 'documentacion_notas',      db: createDb('documentacion_notas', 'DB_DOC_NOTAS_SQLITE_PATH') },
  { name: 'documentacion_escaneo',    db: createDb('documentacion_escaneo', 'DB_DOC_ESCANEO_SQLITE_PATH') },
  { name: 'documentacion_archivo',    db: createDb('documentacion_escaneo', 'DB_DOC_ESCANEO_SQLITE_PATH') },
  { name: 'funcionalidades',          db: createDb('funcionalidades', 'DB_FUNCIONALIDADES_SQLITE_PATH') },
  { name: 'redmine_comentarios',      db: createDb('redmine_comentarios', 'DB_REDMINE_COMENTARIOS_SQLITE_PATH') },
];

async function migrate() {
  const dbOrigen = knex(config);

  try {
    console.log('--- Migración de datos ---');

    const deduped = [];
    const seen = new Set();
    for (const t of TABLES) {
      const key = t.name;
      if (!seen.has(key)) {
        seen.add(key);
        deduped.push(t);
      }
    }

    for (const { name, db: dbDestino } of deduped) {
      await dbDestino.migrate.latest();
      console.log(`[migrate] Migraciones de ${name} ejecutadas.`);

      let registros = [];
      try {
        registros = await dbOrigen(name).select('*');
      } catch (err) {
        console.log(`[origen] ${name}: tabla no encontrada en app.db (omitida)`);
        await dbDestino.destroy();
        continue;
      }
      console.log(`[origen] ${name}: ${registros.length} registros leídos.`);

      let insertados = 0;
      let omitidos = 0;

      for (const r of registros) {
        const pkCol = name === 'global_settings' ? 'setting_key' : 'id';
        const pkVal = name === 'global_settings' ? r.setting_key : r.id;

        const existente = await dbDestino(name).where(pkCol, pkVal).first();
        if (existente) {
          omitidos++;
          continue;
        }

        await dbDestino(name).insert(r);
        insertados++;
      }

      console.log(`[destino] ${name}: Insertados ${insertados}, Omitidos ${omitidos}`);
      await dbDestino.destroy();
    }

    console.log('--- Migración completada ---');
  } catch (err) {
    console.log('[error] Falló la migración:', err.message, '\n', err.stack);
    process.exit(1);
  } finally {
    await dbOrigen.destroy();
  }
}

migrate();
