export function up(knex) {
  return knex.schema
    .table('documentacion_escaneo', (table) => {
      table.index(['session_id', 'fecha_hora_inicio']);
    })
    .table('documentacion_archivo', (table) => {
      table.index('escaneo_id');
    });
}

export function down(knex) {
  return knex.schema
    .table('documentacion_escaneo', (table) => {
      table.dropIndex(['session_id', 'fecha_hora_inicio']);
    })
    .table('documentacion_archivo', (table) => {
      table.dropIndex('escaneo_id');
    });
}
