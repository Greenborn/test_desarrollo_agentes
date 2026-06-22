export function up(knex) {
  return knex.schema.createTable('redmine_comentarios', (table) => {
    table.increments('id');
    table.integer('session_id').unsigned().notNullable().references('id').inTable('chat_sessions').onDelete('CASCADE');
    table.integer('ticket_redmine_id').notNullable();
    table.text('comentario').notNullable();
    table.integer('workspace_id').unsigned().notNullable().defaultTo(1);
    table.enu('estado', ['pendiente', 'enviado', 'error']).notNullable().defaultTo('pendiente');
    table.timestamp('created_at').defaultTo(knex.fn.now());
    table.timestamp('updated_at').defaultTo(knex.fn.now());
  });
}

export function down(knex) {
  return knex.schema.dropTableIfExists('redmine_comentarios');
}
