export function up(knex) {
  return knex.schema.alterTable('playwright_event_recordings', (table) => {
    table.string('project_id', 255).nullable();
    table.dropUnique('name');
  });
}

export function down(knex) {
  return knex.schema.alterTable('playwright_event_recordings', (table) => {
    table.dropColumn('project_id');
    table.unique('name');
  });
}
