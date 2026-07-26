export function up(knex) {
  return knex.schema.createTable('funcionalidades', (table) => {
    table.increments('id').primary();
    table.integer('session_id').unsigned().notNullable();
    table.timestamp('fecha_hora').defaultTo(knex.fn.now());
    table.string('etapa', 50).defaultTo('RELEVAMIENTO');
    table.text('parametros').nullable();
    table.unique('session_id');
  });
}

export function down(knex) {
  return knex.schema.dropTableIfExists('funcionalidades');
}
