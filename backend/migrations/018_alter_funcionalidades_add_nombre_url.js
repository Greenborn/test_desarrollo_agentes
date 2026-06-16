export async function up(knex) {
  const hasNombre = await knex.schema.hasColumn('funcionalidades', 'nombre');
  if (!hasNombre) {
    await knex.schema.alterTable('funcionalidades', (table) => {
      table.string('nombre', 255).notNullable().defaultTo('Sin nombre');
      table.string('url_redmine', 255).nullable();
    });
  }
  const hasUnique = await knex.raw(
    "SELECT CONSTRAINT_NAME FROM information_schema.TABLE_CONSTRAINTS WHERE TABLE_SCHEMA = ? AND TABLE_NAME = 'funcionalidades' AND CONSTRAINT_TYPE = 'UNIQUE'",
    [knex.client.database()]
  );
  if (hasUnique[0] && hasUnique[0].length > 0) {
    await knex.raw('ALTER TABLE funcionalidades ADD INDEX funcionalidades_session_id_index (session_id), DROP INDEX funcionalidades_session_id_unique');
  }
}

export async function down(knex) {
  const hasNombre = await knex.schema.hasColumn('funcionalidades', 'nombre');
  if (hasNombre) {
    await knex.schema.alterTable('funcionalidades', (table) => {
      table.dropColumn('nombre');
      table.dropColumn('url_redmine');
    });
  }
  try {
    await knex.raw('ALTER TABLE funcionalidades DROP INDEX funcionalidades_session_id_index, ADD UNIQUE (session_id)');
  } catch (e) {
    // may already exist or index may not exist
  }
}
