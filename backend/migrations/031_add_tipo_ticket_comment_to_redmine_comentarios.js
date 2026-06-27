export async function up(knex) {
  await knex.raw("ALTER TABLE `redmine_comentarios` MODIFY COLUMN `tipo` ENUM('comentario_commit', 'ticket_edit', 'ticket_comment') NOT NULL DEFAULT 'comentario_commit'");
}

export async function down(knex) {
  await knex.raw("ALTER TABLE `redmine_comentarios` MODIFY COLUMN `tipo` ENUM('comentario_commit', 'ticket_edit') NOT NULL DEFAULT 'comentario_commit'");
}
