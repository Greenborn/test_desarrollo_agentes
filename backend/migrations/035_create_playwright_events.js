export function up(knex) {
  return knex.schema.createTable('playwright_events', (table) => {
    table.increments('id');
    table.integer('chat_session_id').unsigned().notNullable().references('id').inTable('chat_sessions').onDelete('CASCADE');
    table.string('playwright_session_id', 36).notNullable();
    table.string('event_type', 50).notNullable();
    table.text('selector').nullable();
    table.string('tag_name', 50).nullable();
    table.text('text_content').nullable();
    table.text('value').nullable();
    table.text('url').nullable();
    table.integer('x').nullable();
    table.integer('y').nullable();
    table.string('key', 50).nullable();
    table.text('key_code').nullable();
    table.boolean('alt_key').nullable();
    table.boolean('ctrl_key').nullable();
    table.boolean('shift_key').nullable();
    table.boolean('meta_key').nullable();
    table.integer('scroll_x').nullable();
    table.integer('scroll_y').nullable();
    table.text('target_rect').nullable();
    table.text('metadata').nullable();
    table.timestamp('created_at').defaultTo(knex.fn.now());
    table.index('chat_session_id');
    table.index('playwright_session_id');
  });
}

export function down(knex) {
  return knex.schema.dropTableIfExists('playwright_events');
}
