export async function up(knex) {
  const tablesToDrop = ['tickets', 'proyectos'];

  for (const table of tablesToDrop) {
    const exists = await knex.schema.hasTable(table);
    if (exists) {
      await knex.schema.dropTableIfExists(table);
      console.log(`[migrate] Tabla "${table}" eliminada de app.db (migrada a DB separada)`);
    }
  }
}

export async function down(knex) {
  console.log('[migrate] Rollback de limpieza no soportado. Las tablas se mantienen eliminadas de app.db.');
}
