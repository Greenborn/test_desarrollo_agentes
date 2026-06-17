export async function up(knex) {
  const hasRedmineId = await knex.schema.hasColumn('proyectos', 'redmine_id');
  if (!hasRedmineId) {
    await knex.raw('ALTER TABLE proyectos MODIFY COLUMN descripcion TEXT NOT NULL');
    await knex.schema.alterTable('proyectos', (table) => {
      table.integer('redmine_id').notNullable().unique();
      table.integer('redmine_status').nullable();
      table.datetime('redmine_created_on').nullable();
      table.datetime('redmine_updated_on').nullable();
      table.string('redmine_parent_id', 255).nullable();
      table.string('redmine_parent_name', 255).nullable();
    });
  }
}

export async function down(knex) {
  const hasRedmineId = await knex.schema.hasColumn('proyectos', 'redmine_id');
  if (hasRedmineId) {
    await knex.schema.alterTable('proyectos', (table) => {
      table.dropColumn('redmine_parent_name');
      table.dropColumn('redmine_parent_id');
      table.dropColumn('redmine_updated_on');
      table.dropColumn('redmine_created_on');
      table.dropColumn('redmine_status');
      table.dropColumn('redmine_id');
    });
    await knex.raw('ALTER TABLE proyectos MODIFY COLUMN descripcion VARCHAR(255) NOT NULL');
  }
}
