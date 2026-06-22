export function up(knex) {
  return knex.schema.alterTable('templates', (table) => {
    table.boolean('is_protected').notNullable().defaultTo(false);
  });
}

export function down(knex) {
  return knex.schema.alterTable('templates', (table) => {
    table.dropColumn('is_protected');
  });
}
