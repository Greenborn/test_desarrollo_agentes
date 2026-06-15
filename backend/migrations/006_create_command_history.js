export function up(knex) {
  return knex.schema.createTable('command_history', (table) => {
    table.increments('id');
    table.integer('user_id').unsigned().notNullable().references('id').inTable('users').onDelete('CASCADE');
    table.string('command', 500).notNullable();
    table.timestamp('created_at').defaultTo(knex.fn.now());
  });
}

export function down(knex) {
  return knex.schema.dropTableIfExists('command_history');
}
