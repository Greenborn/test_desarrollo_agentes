import 'dotenv/config';
import knex from 'knex';
import config from '../knexfile.js';
import configKnex from '../knexfileConfig.js';

async function migrate() {
  const dbOrigen = knex(config);
  const dbDestino = knex(configKnex);

  try {
    console.log('--- Migración de datos: settings ---');

    await dbDestino.migrate.latest();
    console.log('[migrate] Migraciones de configuración ejecutadas.');

    const registros = await dbOrigen('settings').select('*');
    console.log(`[origen] Leídos ${registros.length} registros de app.db.`);

    let insertados = 0;
    let omitidos = 0;

    for (const r of registros) {
      const existente = await dbDestino('settings')
        .where({ id: r.id })
        .first();

      if (existente) {
        omitidos++;
        continue;
      }

      await dbDestino('settings').insert({
        id: r.id,
        workspace_id: r.workspace_id,
        setting_key: r.setting_key,
        setting_value: r.setting_value,
        encrypted: r.encrypted || false,
        updated_at: r.updated_at,
      });
      insertados++;
    }

    console.log(`[destino] Insertados: ${insertados}, Omitidos (ya existentes): ${omitidos}`);
    console.log('--- Migración completada ---');
  } catch (err) {
    console.log('[error] Falló la migración de configuración:', err.message, '\n', err.stack);
    process.exit(1);
  } finally {
    await dbOrigen.destroy();
    await dbDestino.destroy();
  }
}

migrate();
