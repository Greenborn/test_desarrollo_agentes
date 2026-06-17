export function up(knex) {
  return knex.schema.alterTable('tickets', (table) => {
    table.integer('priority_id').nullable().after('priority_name');
  });
}

export function down(knex) {
  return knex.schema.alterTable('tickets', (table) => {
    table.dropColumn('priority_id');
  });
}
