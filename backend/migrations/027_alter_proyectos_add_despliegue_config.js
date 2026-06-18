export function up(knex) {
  return knex.schema.alterTable('proyectos', (table) => {
    table.text('despliegue_config').nullable();
  });
}

export function down(knex) {
  return knex.schema.alterTable('proyectos', (table) => {
    table.dropColumn('despliegue_config');
  });
}
