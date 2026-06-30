export function up(knex) {
  return knex.schema.createTable('global_settings', (table) => {
    table.string('setting_key', 100).primary();
    table.text('setting_value').notNullable();
    table.timestamp('updated_at').defaultTo(knex.fn.now());
  });
}

export function down(knex) {
  return knex.schema.dropTableIfExists('global_settings');
}
