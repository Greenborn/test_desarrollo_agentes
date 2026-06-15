export function up(knex) {
  return knex.schema.table('command_history', (table) => {
    table.integer('session_id').unsigned().nullable().references('id').inTable('chat_sessions').onDelete('SET NULL');
  });
}

export function down(knex) {
  return knex.schema.table('command_history', (table) => {
    table.dropColumn('session_id');
  });
}
