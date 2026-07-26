export async function up(knex) {
  const tablesToDrop = [
    'comandos_personalizados_proyectos',
    'settings',
    'global_settings',
    'user_settings',
    'workspace_environments',
    'templates',
    'project_variables',
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
  // No rollback — las tablas se recrean desde las DBs separadas si es necesario
  console.log('[migrate] Rollback de limpieza no soportado. Las tablas se mantienen eliminadas de app.db.');
}
