export function up(knex) {
  return knex.schema.createTable('templates', (table) => {
    table.increments('id');
    table.string('slug', 100).notNullable().unique();
    table.text('content').notNullable();
    table.timestamp('created_at').defaultTo(knex.fn.now());
    table.timestamp('updated_at').defaultTo(knex.fn.now());
  });
}

export function down(knex) {
  return knex.schema.dropTableIfExists('templates');
}
