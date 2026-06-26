export function up(knex) {
  return knex.schema.alterTable('project_variables', (table) => {
    table.string('type', 20).notNullable().defaultTo('db');
  });
}

export function down(knex) {
  return knex.schema.alterTable('project_variables', (table) => {
    table.dropColumn('type');
  });
}
