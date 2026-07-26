export function up(knex) {
  return knex.schema
    .createTable('documentacion_escaneo', (table) => {
      table.increments('id').primary();
      table.integer('session_id').unsigned().notNullable();
      table.timestamp('fecha_hora_inicio').defaultTo(knex.fn.now());
      table.timestamp('fecha_hora_fin').nullable();
      table.integer('total_archivos').nullable();
      table.integer('archivos_procesados').nullable();
      table.index(['session_id', 'fecha_hora_inicio']);
    })
    .createTable('documentacion_archivo', (table) => {
      table.increments('id').primary();
      table.integer('escaneo_id').unsigned().notNullable();
      table.string('nombre', 500).notNullable();
      table.text('ruta').notNullable();
      table.string('tipo', 50).notNullable();
      table.string('extension', 50).nullable();
      table.integer('tamano').nullable();
      table.text('descripcion').nullable();
      table.index('escaneo_id');
    });
}

export function down(knex) {
  return knex.schema
    .dropTableIfExists('documentacion_archivo')
    .dropTableIfExists('documentacion_escaneo');
}
