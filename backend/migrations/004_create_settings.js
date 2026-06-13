export function up(knex) {
  return knex.schema.createTable('settings', (table) => {
    table.increments('id');
    table.string('setting_key', 100).notNullable().unique();
    table.text('setting_value').notNullable();
    table.boolean('encrypted').defaultTo(false);
    table.timestamp('updated_at').defaultTo(knex.fn.now());
  });
}

export function down(knex) {
  return knex.schema.dropTableIfExists('settings');
}
