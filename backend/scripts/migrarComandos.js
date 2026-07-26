import 'dotenv/config';
import knex from 'knex';
import config from '../knexfile.js';
import comandosConfig from '../knexfileComandos.js';

async function migrate() {
  const dbOrigen = knex(config);
  const dbDestino = knex(comandosConfig);

  try {
    console.log('--- Migración de datos: comandos_personalizados_proyectos ---');

    await dbDestino.migrate.latest();
    console.log('[migrate] Migraciones de comandos ejecutadas.');

    const registros = await dbOrigen('comandos_personalizados_proyectos').select('*');
    console.log(`[origen] Leídos ${registros.length} registros de app.db.`);

    let insertados = 0;
    let omitidos = 0;

    for (const r of registros) {
      const existente = await dbDestino('comandos_personalizados_proyectos')
        .where({ id: r.id })
        .first();

      if (existente) {
        omitidos++;
        continue;
      }

      await dbDestino('comandos_personalizados_proyectos').insert({
        id: r.id,
        label: r.label,
        descripcion: r.descripcion,
        id_proyecto: r.id_proyecto,
        comando: r.comando,
        ocultar_ejecucion: r.ocultar_ejecucion !== undefined ? r.ocultar_ejecucion : false,
        created_at: r.created_at,
        updated_at: r.updated_at,
      });
      insertados++;
    }

    console.log(`[destino] Insertados: ${insertados}, Omitidos (ya existentes): ${omitidos}`);
    console.log('--- Migración completada ---');
  } catch (err) {
    console.log('[error] Falló la migración de comandos:', err.message, '\n', err.stack);
    process.exit(1);
  } finally {
    await dbOrigen.destroy();
    await dbDestino.destroy();
  }
}

migrate();
