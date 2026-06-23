export function up(knex) {
  return knex.schema.alterTable('playwright_events', (table) => {
    table.integer('recording_id').unsigned().nullable().references('id').inTable('playwright_event_recordings').onDelete('SET NULL');
    table.index('recording_id');
  });
}

export function down(knex) {
  return knex.schema.alterTable('playwright_events', (table) => {
    table.dropIndex('recording_id');
    table.dropColumn('recording_id');
  });
}
