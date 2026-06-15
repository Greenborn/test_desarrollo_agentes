export function up(knex) {
  return knex.schema.alterTable('chat_sessions', (table) => {
    table.string('proyecto_id').nullable();
  });
}

export function down(knex) {
  return knex.schema.alterTable('chat_sessions', (table) => {
    table.dropColumn('proyecto_id');
  });
}
