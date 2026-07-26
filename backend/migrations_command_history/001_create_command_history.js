export function up(knex) {
  return knex.schema.createTable('command_history', (table) => {
    table.increments('id').primary();
    table.integer('user_id').unsigned().notNullable();
    table.string('command', 500).notNullable();
    table.integer('session_id').unsigned().nullable();
    table.timestamp('created_at').defaultTo(knex.fn.now());
  });
}

export function down(knex) {
  return knex.schema.dropTableIfExists('command_history');
}
