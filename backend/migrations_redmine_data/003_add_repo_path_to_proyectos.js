export function up(knex) {
  return knex.schema.alterTable('proyectos', (table) => {
    table.string('repo_path', 500).nullable();
  });
}

export function down(knex) {
  return knex.schema.alterTable('proyectos', (table) => {
    table.dropColumn('repo_path');
  });
}
