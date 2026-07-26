export function up(knex) {
  return knex.schema
    .createTable('playwright_network_logs', (table) => {
      table.increments('id').primary();
      table.integer('chat_session_id').unsigned().notNullable();
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
    })
    .createTable('playwright_console_logs', (table) => {
      table.increments('id').primary();
      table.integer('chat_session_id').unsigned().notNullable();
      table.string('playwright_session_id', 36).notNullable();
      table.string('type', 20).notNullable();
      table.text('text').notNullable();
      table.text('location').nullable();
      table.timestamp('created_at').defaultTo(knex.fn.now());
    })
    .createTable('playwright_events', (table) => {
      table.increments('id').primary();
      table.integer('chat_session_id').unsigned().nullable();
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
      table.integer('recording_id').unsigned().nullable();
      table.timestamp('created_at').defaultTo(knex.fn.now());
      table.index('chat_session_id');
      table.index('playwright_session_id');
      table.index('recording_id');
    })
    .createTable('playwright_event_recordings', (table) => {
      table.increments('id').primary();
      table.integer('chat_session_id').unsigned().nullable();
      table.string('name', 255).notNullable();
      table.string('playwright_session_id', 36).nullable();
      table.string('project_id', 255).notNullable().defaultTo('');
      table.timestamp('created_at').defaultTo(knex.fn.now());
    });
}

export function down(knex) {
  return knex.schema
    .dropTableIfExists('playwright_events')
    .dropTableIfExists('playwright_event_recordings')
    .dropTableIfExists('playwright_console_logs')
    .dropTableIfExists('playwright_network_logs');
}
