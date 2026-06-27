export function up(knex) {
  return knex.schema.alterTable('chat_messages', (table) => {
    table.text('content', 'longtext').alter();
    table.text('thinking', 'longtext').alter();
  });
}

export function down(knex) {
  return knex.schema.alterTable('chat_messages', (table) => {
    table.text('content').alter();
    table.text('thinking').alter();
  });
}
