export function up(knex) {
  return knex.schema.createTable('settings', (table) => {
    table.increments('id').primary();
    table.integer('workspace_id').unsigned().notNullable().defaultTo(1);
    table.string('setting_key', 100).notNullable();
    table.text('setting_value').notNullable();
    table.boolean('encrypted').defaultTo(false);
    table.timestamp('updated_at').defaultTo(knex.fn.now());
    table.unique(['workspace_id', 'setting_key']);
  });
}

export function down(knex) {
  return knex.schema.dropTableIfExists('settings');
}
