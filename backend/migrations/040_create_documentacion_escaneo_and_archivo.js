export function up(knex) {
  return knex.schema
    .createTable('documentacion_escaneo', (table) => {
      table.increments('id');
      table.integer('session_id').unsigned().notNullable()
        .references('id').inTable('chat_sessions').onDelete('CASCADE');
      table.timestamp('fecha_hora_inicio').defaultTo(knex.fn.now());
      table.timestamp('fecha_hora_fin').nullable();
      table.integer('total_archivos').nullable();
      table.integer('archivos_procesados').nullable();
    })
    .createTable('documentacion_archivo', (table) => {
      table.increments('id');
      table.integer('escaneo_id').unsigned().notNullable()
        .references('id').inTable('documentacion_escaneo').onDelete('CASCADE');
      table.string('nombre', 500).notNullable();
      table.text('ruta').notNullable();
      table.string('tipo', 50).notNullable();
      table.string('extension', 50).nullable();
      table.integer('tamano').nullable();
      table.text('descripcion').nullable();
    });
}

export function down(knex) {
  return knex.schema
    .dropTableIfExists('documentacion_archivo')
    .dropTableIfExists('documentacion_escaneo');
}
