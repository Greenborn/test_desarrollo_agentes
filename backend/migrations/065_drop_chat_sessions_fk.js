export async function up(knex) {
  await knex.schema.dropTableIfExists('chat_sessions');
  await knex.schema.createTable('chat_sessions', (table) => {
    table.increments('id').primary();
    table.integer('user_id').unsigned().notNullable();
    table.integer('workspace_id').unsigned().notNullable().defaultTo(1);
    table.string('title', 255).nullable();
    table.string('cwd', 500).nullable();
    table.string('proyecto_id', 255).nullable();
    table.integer('id_ticket_redmine').nullable();
    table.boolean('archived').notNullable().defaultTo(false);
    table.timestamp('created_at').defaultTo(knex.fn.now());
    table.timestamp('updated_at').defaultTo(knex.fn.now());
  });
}

export async function down(knex) {
  console.log('[migrate] Rollback de chat_sessions no soportado.');
}
