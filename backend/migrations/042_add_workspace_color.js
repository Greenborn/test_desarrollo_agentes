export function up(knex) {
  return knex.schema.alterTable('workspaces', (table) => {
    table.string('color', 7).defaultTo('#75AADB');
  });
}

export function down(knex) {
  return knex.schema.alterTable('workspaces', (table) => {
    table.dropColumn('color');
  });
}
