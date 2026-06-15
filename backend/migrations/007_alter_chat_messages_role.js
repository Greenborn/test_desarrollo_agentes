export function up(knex) {
  return knex.schema.alterTable('chat_messages', (table) => {
    table.enu('role', ['user', 'assistant', 'command', 'result']).alter();
  });
}

export function down(knex) {
  return knex.schema.alterTable('chat_messages', (table) => {
    table.enu('role', ['user', 'assistant']).alter();
  });
}
