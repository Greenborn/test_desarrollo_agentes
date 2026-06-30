export function up(knex) {
  return knex.schema.alterTable('documentacion_notas', (table) => {
    table.integer('id_ticket').nullable().alter();
  });
}

export function down(knex) {
  return knex.schema.alterTable('documentacion_notas', (table) => {
    table.integer('id_ticket').notNullable().alter();
  });
}
