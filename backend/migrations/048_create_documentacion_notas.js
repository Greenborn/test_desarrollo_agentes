export function up(knex) {
  return knex.schema.createTable('documentacion_notas', (table) => {
    table.increments('id').primary();
    table.string('id_proyecto', 255).notNullable();
    table.string('clave', 255).notNullable();
    table.text('valor');
    table.integer('id_ticket').notNullable();
    table.timestamp('created_at').defaultTo(knex.fn.now());
    table.timestamp('updated_at').defaultTo(knex.fn.now());
    table.unique(['id_proyecto', 'clave']);
    table.index('id_proyecto');
  });
}

export function down(knex) {
  return knex.schema.dropTableIfExists('documentacion_notas');
}
