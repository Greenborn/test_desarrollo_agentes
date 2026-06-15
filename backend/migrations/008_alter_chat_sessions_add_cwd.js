export function up(knex) {
  return knex.schema.alterTable('chat_sessions', (table) => {
    table.string('cwd', 500).nullable();
  });
}

export function down(knex) {
  return knex.schema.alterTable('chat_sessions', (table) => {
    table.dropColumn('cwd');
  });
}
