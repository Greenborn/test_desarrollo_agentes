export function up(knex) {
  return knex.schema.alterTable('proyectos', (table) => {
    table.string('color', 7).defaultTo('#6b7280');
  });
}

export function down(knex) {
  return knex.schema.alterTable('proyectos', (table) => {
    table.dropColumn('color');
  });
}
