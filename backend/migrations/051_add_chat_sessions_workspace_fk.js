export function up(knex) {
  return knex.schema.alterTable('chat_sessions', (table) => {
    table.foreign('workspace_id').references('id').inTable('workspaces');
  });
}

export function down(knex) {
  return knex.schema.alterTable('chat_sessions', (table) => {
    table.dropForeign(['workspace_id']);
  });
}
