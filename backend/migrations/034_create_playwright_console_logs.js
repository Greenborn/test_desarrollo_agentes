export function up(knex) {
  return knex.schema.createTable('playwright_console_logs', (table) => {
    table.increments('id');
    table.integer('chat_session_id').unsigned().notNullable().references('id').inTable('chat_sessions').onDelete('CASCADE');
    table.string('playwright_session_id', 36).notNullable();
    table.string('type', 20).notNullable();
    table.text('text').notNullable();
    table.text('location').nullable();
    table.timestamp('created_at').defaultTo(knex.fn.now());
  });
}

export function down(knex) {
  return knex.schema.dropTableIfExists('playwright_console_logs');
}
