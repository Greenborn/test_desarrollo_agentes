export function up(knex) {
  return knex.schema.createTable('gastos_tokens_usados', (table) => {
    table.increments('id');
    table.integer('id_chat_session').unsigned().notNullable().references('id').inTable('chat_sessions').onDelete('CASCADE');
    table.string('id_proyecto', 255).notNullable().references('id').inTable('proyectos').onDelete('CASCADE');
    table.decimal('precio', 10, 4).notNullable();
    table.integer('tokens').notNullable();
    table.timestamp('fecha_hora').defaultTo(knex.fn.now());
  });
}

export function down(knex) {
  return knex.schema.dropTableIfExists('gastos_tokens_usados');
}
