export function up(knex) {
  return knex.schema.createTable('comandos_personalizados_proyectos', (table) => {
    table.increments('id').primary();
    table.string('label', 255).notNullable();
    table.text('descripcion').nullable();
    table.string('id_proyecto', 255).notNullable();
    table.string('comando', 512).notNullable();
    table.timestamp('created_at').defaultTo(knex.fn.now());
    table.timestamp('updated_at').defaultTo(knex.fn.now());
  });
}

export function down(knex) {
  return knex.schema.dropTableIfExists('comandos_personalizados_proyectos');
}
