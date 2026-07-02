export function up(knex) {
  return knex.schema.alterTable('comandos_personalizados_proyectos', (table) => {
    table.boolean('ocultar_ejecucion').notNullable().defaultTo(false);
  });
}

export function down(knex) {
  return knex.schema.alterTable('comandos_personalizados_proyectos', (table) => {
    table.dropColumn('ocultar_ejecucion');
  });
}
