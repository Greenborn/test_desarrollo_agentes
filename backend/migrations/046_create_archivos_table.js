export function up(knex) {
  return knex.schema.createTable('archivos', (table) => {
    table.increments('id').primary();
    table.string('proyecto_id', 255).notNullable();
    table.integer('chat_session_id').unsigned().notNullable()
      .references('id').inTable('chat_sessions').onDelete('CASCADE');
    table.string('nombre_original', 500).notNullable();
    table.string('nombre_storage', 500).notNullable();
    table.string('tipo', 100).notNullable();
    table.integer('tamano').notNullable();
    table.timestamp('created_at').defaultTo(knex.fn.now());
  });
}

export function down(knex) {
  return knex.schema.dropTableIfExists('archivos');
}
