export function up(knex) {
  return knex.schema.createTable('workspace_environments', (table) => {
    table.increments('id');
    table.integer('workspace_id').unsigned().notNullable().defaultTo(1);
    table.string('name', 100).notNullable();
    table.string('branch', 255).notNullable();
    table.text('description').nullable();
    table.timestamp('created_at').defaultTo(knex.fn.now());
    table.timestamp('updated_at').defaultTo(knex.fn.now());
    table.unique(['workspace_id', 'name']);
  });
}

export function down(knex) {
  return knex.schema.dropTableIfExists('workspace_environments');
}
