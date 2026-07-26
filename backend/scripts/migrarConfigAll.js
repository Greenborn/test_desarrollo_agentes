import 'dotenv/config';
import knex from 'knex';
import config from '../knexfile.js';
import { createDb } from '../src/config/dbFactory.js';

const TABLES = [
  { name: 'global_settings',        db: createDb('global_settings', 'DB_GLOBAL_SETTINGS_SQLITE_PATH') },
  { name: 'user_settings',          db: createDb('user_settings', 'DB_USER_SETTINGS_SQLITE_PATH') },
  { name: 'workspace_environments', db: createDb('workspace_environments', 'DB_WORKSPACE_ENVIRONMENTS_SQLITE_PATH') },
  { name: 'templates',              db: createDb('templates', 'DB_TEMPLATES_SQLITE_PATH') },
  { name: 'project_variables',      db: createDb('project_variables', 'DB_PROJECT_VARIABLES_SQLITE_PATH') },
];

async function migrate() {
  const dbOrigen = knex(config);

  try {
    console.log('--- Migración de datos: configuraciones ---');

    for (const { name, db: dbDestino } of TABLES) {
      await dbDestino.migrate.latest();
      console.log(`[migrate] Migraciones de ${name} ejecutadas.`);

      const registros = await dbOrigen(name).select('*');
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
