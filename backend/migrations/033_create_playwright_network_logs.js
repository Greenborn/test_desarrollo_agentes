export function up(knex) {
  return knex.schema.createTable('playwright_network_logs', (table) => {
    table.increments('id');
    table.integer('chat_session_id').unsigned().notNullable().references('id').inTable('chat_sessions').onDelete('CASCADE');
    table.string('playwright_session_id', 36).notNullable();
    table.string('method', 10).notNullable();
    table.text('url').notNullable();
    table.integer('status_code').nullable();
    table.text('request_headers').nullable();
    table.text('response_headers').nullable();
    table.string('resource_type', 50).nullable();
    table.text('response_body').nullable();
    table.text('error').nullable();
    table.timestamp('created_at').defaultTo(knex.fn.now());
  });
}

export function down(knex) {
  return knex.schema.dropTableIfExists('playwright_network_logs');
}
