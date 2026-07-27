export function up(knex) {
  return knex.schema.createTable('chat_messages', (table) => {
    table.increments('id').primary();
    table.integer('session_id').unsigned().notNullable();
    table.enu('role', [
      'user', 'assistant', 'command', 'result',
      'opencode_info', 'opencode_result', 'opencode_control', 'opencode_confirmed',
    ]).notNullable();
    table.text('content', 'longtext').notNullable();
    table.text('thinking', 'longtext');
    table.timestamp('created_at').defaultTo(knex.fn.now());
  });
}

export function down(knex) {
  return knex.schema.dropTableIfExists('chat_messages');
}
