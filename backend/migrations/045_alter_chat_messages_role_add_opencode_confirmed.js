export function up(knex) {
  return knex.schema.alterTable('chat_messages', (table) => {
    table.enu('role', [
      'user', 'assistant', 'command', 'result',
      'opencode_info', 'opencode_result', 'opencode_control', 'opencode_confirmed',
    ]).alter();
  });
}

export function down(knex) {
  return knex.schema.alterTable('chat_messages', (table) => {
    table.enu('role', [
      'user', 'assistant', 'command', 'result',
      'opencode_info', 'opencode_result', 'opencode_control',
    ]).alter();
  });
}
