export function up(knex) {
  const driver = knex.client.config.client;
  if (driver === 'better-sqlite3' || driver === 'sqlite') {
    // SQLite TEXT es ilimitado, no necesita longtext
    return;
  }
  return knex.schema.alterTable('chat_messages', (table) => {
    table.text('content', 'longtext').alter();
    table.text('thinking', 'longtext').alter();
  });
}

export function down(knex) {
  const driver = knex.client.config.client;
  if (driver === 'better-sqlite3' || driver === 'sqlite') {
    return;
  }
  return knex.schema.alterTable('chat_messages', (table) => {
    table.text('content').alter();
    table.text('thinking').alter();
  });
}
