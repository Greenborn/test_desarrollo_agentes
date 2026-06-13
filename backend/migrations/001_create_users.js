export function up(knex) {
  return knex.schema.createTable('users', (table) => {
    table.increments('id');
    table.string('username', 100).notNullable().unique();
    table.string('password_hash', 255).notNullable();
    table.enu('role', ['admin', 'user']).defaultTo('user');
    table.timestamp('created_at').defaultTo(knex.fn.now());
  });
}

export function down(knex) {
  return knex.schema.dropTableIfExists('users');
}
