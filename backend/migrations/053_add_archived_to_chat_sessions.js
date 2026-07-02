export function up(knex) {
  return knex.schema.alterTable('chat_sessions', (table) => {
    table.boolean('archived').notNullable().defaultTo(false);
  });
}

export function down(knex) {
  return knex.schema.alterTable('chat_sessions', (table) => {
    table.dropColumn('archived');
  });
}
