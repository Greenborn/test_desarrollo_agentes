export function up(knex) {
  return knex.schema.table('gastos_tokens_usados', (table) => {
    table.string('id_sesion_opencode', 255).nullable();
  });
}

export function down(knex) {
  return knex.schema.table('gastos_tokens_usados', (table) => {
    table.dropColumn('id_sesion_opencode');
  });
}
