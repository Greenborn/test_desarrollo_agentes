export function up(knex) {
  return knex.schema.alterTable('chat_sessions', (table) => {
    table.text('prefs').nullable();
  });
}
export function down(knex) {
  return knex.schema.alterTable('chat_sessions', (table) => {
    table.dropColumn('prefs');
  });
}
