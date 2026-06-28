export function up(knex) {
  return knex.schema.createTable('capturas_metadata', (table) => {
    table.increments('id').primary();
    table.integer('archivo_id').unsigned().notNullable()
      .references('id').inTable('archivos').onDelete('CASCADE');
    table.string('key', 255).notNullable();
    table.longtext('value').notNullable();
    table.timestamp('created_at').defaultTo(knex.fn.now());
  });
}

export function down(knex) {
  return knex.schema.dropTableIfExists('capturas_metadata');
}
