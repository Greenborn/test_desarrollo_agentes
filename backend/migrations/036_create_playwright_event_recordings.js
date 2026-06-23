export function up(knex) {
  return knex.schema.createTable('playwright_event_recordings', (table) => {
    table.increments('id');
    table.integer('chat_session_id').unsigned().notNullable().references('id').inTable('chat_sessions').onDelete('CASCADE');
    table.string('name', 255).notNullable().unique();
    table.string('playwright_session_id', 36).nullable();
    table.timestamp('created_at').defaultTo(knex.fn.now());
  });
}

export function down(knex) {
  return knex.schema.dropTableIfExists('playwright_event_recordings');
}
