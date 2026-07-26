export async function up(knex) {
  const hasUnique = await knex.schema.hasColumn('tickets', 'redmine_id');
  if (!hasUnique) return;

  const driver = knex.client.config.client;
  if (driver === 'better-sqlite3' || driver === 'sqlite') {
    await knex.schema.alterTable('tickets', (table) => {
      table.dropUnique(['redmine_id']);
      table.unique(['redmine_id', 'workspace_id']);
    });
    return;
  }

  await knex.raw('ALTER TABLE tickets DROP INDEX tickets_redmine_id_unique');
  await knex.raw('ALTER TABLE tickets ADD UNIQUE KEY tickets_redmine_id_workspace_id_unique (redmine_id, workspace_id)');
}

export async function down(knex) {
  const hasUnique = await knex.schema.hasColumn('tickets', 'redmine_id');
  if (!hasUnique) return;

  const driver = knex.client.config.client;
  if (driver === 'better-sqlite3' || driver === 'sqlite') {
    await knex.schema.alterTable('tickets', (table) => {
      table.dropUnique(['redmine_id', 'workspace_id']);
      table.unique(['redmine_id']);
    });
    return;
  }

  await knex.raw('ALTER TABLE tickets DROP INDEX tickets_redmine_id_workspace_id_unique');
  await knex.raw('ALTER TABLE tickets ADD UNIQUE KEY tickets_redmine_id_unique (redmine_id)');
}