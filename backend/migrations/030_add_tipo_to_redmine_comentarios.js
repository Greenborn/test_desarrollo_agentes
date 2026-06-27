export function up(knex) {
  return knex.schema.alterTable('redmine_comentarios', (table) => {
    table.enu('tipo', ['comentario_commit', 'ticket_edit']).notNullable().defaultTo('comentario_commit');
  });
}

export function down(knex) {
  return knex.schema.alterTable('redmine_comentarios', (table) => {
    table.dropColumn('tipo');
  });
}
