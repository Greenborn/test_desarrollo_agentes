export async function up(knex) {
  const tablesToDrop = [
    'command_history',
    'gastos_tokens_usados',
    'playwright_network_logs',
    'playwright_console_logs',
    'playwright_events',
    'playwright_event_recordings',
    'documentacion_base_datos',
    'documentacion_subproyectos',
    'documentacion_endpoints',
    'documentacion_web_sockets',
    'documentacion_funcionalidades',
    'documentacion_notas',
    'documentacion_escaneo',
    'documentacion_archivo',
  ];

  for (const table of tablesToDrop) {
    const exists = await knex.schema.hasTable(table);
    if (exists) {
      await knex.schema.dropTableIfExists(table);
      console.log(`[migrate] Tabla "${table}" eliminada de app.db (migrada a DB separada)`);
    }
  }
}

export async function down(knex) {
  console.log('[migrate] Rollback de limpieza no soportado.');
}
