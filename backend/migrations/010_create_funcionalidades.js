export function up(knex) {
  return knex.schema.createTable('funcionalidades', (table) => {
    table.increments('id');
    table.integer('session_id').unsigned().notNullable().references('id').inTable('chat_sessions').onDelete('CASCADE');
    table.timestamp('fecha_hora').defaultTo(knex.fn.now());
    table.enu('etapa', ['RELEVAMIENTO', 'DISENIO', 'IMPLEMENTACION', 'TESTING']).defaultTo('RELEVAMIENTO');
    table.text('parametros').nullable();
    table.unique('session_id');
  });
}

export function down(knex) {
  return knex.schema.dropTableIfExists('funcionalidades');
}
