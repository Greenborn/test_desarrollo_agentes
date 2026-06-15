export function up(knex) {
  return knex.schema.createTable('user_settings', (table) => {
    table.increments('id');
    table.integer('user_id').unsigned().notNullable().references('id').inTable('users').onDelete('CASCADE');
    table.string('key', 255).notNullable();
    table.text('value', 'longtext');
    table.timestamp('created_at').defaultTo(knex.fn.now());
    table.timestamp('updated_at').defaultTo(knex.fn.now());
    table.unique(['user_id', 'key']);
  });
}

export function down(knex) {
  return knex.schema.dropTableIfExists('user_settings');
}
