export function up(knex) {
  return knex.schema.createTable('chat_messages', (table) => {
    table.increments('id');
    table.integer('session_id').unsigned().notNullable().references('id').inTable('chat_sessions').onDelete('CASCADE');
    table.enu('role', ['user', 'assistant']).notNullable();
    table.text('content').notNullable();
    table.text('thinking');
    table.timestamp('created_at').defaultTo(knex.fn.now());
  });
}

export function down(knex) {
  return knex.schema.dropTableIfExists('chat_messages');
}
