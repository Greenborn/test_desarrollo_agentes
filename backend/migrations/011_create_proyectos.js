export function up(knex) {
  return knex.schema.createTable('proyectos', (table) => {
    table.string('id').primary();
    table.string('descripcion', 255).notNullable();
  });
}

export function down(knex) {
  return knex.schema.dropTableIfExists('proyectos');
}
