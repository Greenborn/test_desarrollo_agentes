export function up(knex) {
  return knex.schema
    .createTable('documentacion_base_datos', (table) => {
      table.increments('id').primary();
      table.string('id_proyecto').notNullable().references('id').inTable('proyectos');
      table.json('data');
      table.timestamp('fecha_creacion').defaultTo(knex.fn.now());
      table.timestamp('fecha_edicion').defaultTo(knex.fn.now());
    })
    .createTable('documentacion_subproyectos', (table) => {
      table.increments('id').primary();
      table.string('id_proyecto').notNullable().references('id').inTable('proyectos');
      table.json('data');
      table.timestamp('fecha_creacion').defaultTo(knex.fn.now());
      table.timestamp('fecha_edicion').defaultTo(knex.fn.now());
    })
    .createTable('documentacion_endpoints', (table) => {
      table.increments('id').primary();
      table.string('id_proyecto').notNullable().references('id').inTable('proyectos');
      table.json('data');
      table.timestamp('fecha_creacion').defaultTo(knex.fn.now());
      table.timestamp('fecha_edicion').defaultTo(knex.fn.now());
    })
    .createTable('documentacion_web_sockets', (table) => {
      table.increments('id').primary();
      table.string('id_proyecto').notNullable().references('id').inTable('proyectos');
      table.json('data');
      table.timestamp('fecha_creacion').defaultTo(knex.fn.now());
      table.timestamp('fecha_edicion').defaultTo(knex.fn.now());
    })
    .createTable('documentacion_funcionalidades', (table) => {
      table.increments('id').primary();
      table.string('id_proyecto').notNullable().references('id').inTable('proyectos');
      table.json('data');
      table.timestamp('fecha_creacion').defaultTo(knex.fn.now());
      table.timestamp('fecha_edicion').defaultTo(knex.fn.now());
    });
}

export function down(knex) {
  return knex.schema
    .dropTableIfExists('documentacion_base_datos')
    .dropTableIfExists('documentacion_subproyectos')
    .dropTableIfExists('documentacion_endpoints')
    .dropTableIfExists('documentacion_web_sockets')
    .dropTableIfExists('documentacion_funcionalidades');
}
