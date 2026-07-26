export function up(knex) {
  return knex.schema.createTable('gastos_tokens_usados', (table) => {
    table.increments('id').primary();
    table.integer('id_chat_session').unsigned().notNullable();
    table.string('id_proyecto', 255).notNullable();
    table.decimal('precio', 10, 4).notNullable();
    table.integer('tokens').notNullable();
    table.string('id_sesion_opencode', 255).nullable();
    table.timestamp('fecha_hora').defaultTo(knex.fn.now());
  });
}

export function down(knex) {
  return knex.schema.dropTableIfExists('gastos_tokens_usados');
}
