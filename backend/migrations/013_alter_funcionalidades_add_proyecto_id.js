export function up(knex) {
  return knex.schema.alterTable('funcionalidades', (table) => {
    table.string('proyecto_id', 255).nullable();
  });
}

export function down(knex) {
  return knex.schema.alterTable('funcionalidades', (table) => {
    table.dropColumn('proyecto_id');
  });
}
