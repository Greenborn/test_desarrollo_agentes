export function up(knex) {
  return knex.schema.alterTable('redmine_comentarios', (table) => {
    table.string('tipo', 30).notNullable().defaultTo('comentario_commit');
  });
}

export function down(knex) {
  return knex.schema.alterTable('redmine_comentarios', (table) => {
    table.dropColumn('tipo');
  });
}
