export function up(knex) {
  return knex.schema.createTable('workspaces', (table) => {
    table.increments('id');
    table.string('name', 255).notNullable();
    table.boolean('is_default').defaultTo(false);
    table.timestamp('created_at').defaultTo(knex.fn.now());
  });
}

export function down(knex) {
  return knex.schema.dropTableIfExists('workspaces');
}
