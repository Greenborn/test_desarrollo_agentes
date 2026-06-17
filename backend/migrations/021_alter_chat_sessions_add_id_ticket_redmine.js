export function up(knex) {
  return knex.schema.alterTable('chat_sessions', (table) => {
    table.integer('id_ticket_redmine').nullable()
  })
}

export function down(knex) {
  return knex.schema.alterTable('chat_sessions', (table) => {
    table.dropColumn('id_ticket_redmine')
  })
}
