export function up(knex) {
  return knex.schema
    .alterTable('settings', (table) => {
      table.integer('workspace_id').unsigned().notNullable().defaultTo(1);
      table.dropUnique(['setting_key']);
      table.unique(['workspace_id', 'setting_key']);
    })
    .alterTable('chat_sessions', (table) => {
      table.integer('workspace_id').unsigned().notNullable().defaultTo(1);
    })
    .alterTable('proyectos', (table) => {
      table.integer('workspace_id').unsigned().notNullable().defaultTo(1);
    })
    .alterTable('tickets', (table) => {
      table.integer('workspace_id').unsigned().notNullable().defaultTo(1);
    });
}

export function down(knex) {
  return knex.schema
    .alterTable('settings', (table) => {
      table.dropColumn('workspace_id');
      table.dropUnique(['workspace_id', 'setting_key']);
      table.unique(['setting_key']);
    })
    .alterTable('chat_sessions', (table) => {
      table.dropColumn('workspace_id');
    })
    .alterTable('proyectos', (table) => {
      table.dropColumn('workspace_id');
    })
    .alterTable('tickets', (table) => {
      table.dropColumn('workspace_id');
    });
}
