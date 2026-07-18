export async function up(knex) {
  const hasUnique = await knex.schema.hasColumn('proyectos', 'redmine_id');
  if (hasUnique) {
    await knex.raw('ALTER TABLE proyectos DROP INDEX proyectos_redmine_id_unique');
    await knex.raw('ALTER TABLE proyectos ADD UNIQUE KEY proyectos_redmine_id_workspace_id_unique (redmine_id, workspace_id)');
  }
}

export async function down(knex) {
  const hasUnique = await knex.schema.hasColumn('proyectos', 'redmine_id');
  if (hasUnique) {
    await knex.raw('ALTER TABLE proyectos DROP INDEX proyectos_redmine_id_workspace_id_unique');
    await knex.raw('ALTER TABLE proyectos ADD UNIQUE KEY proyectos_redmine_id_unique (redmine_id)');
  }
}
