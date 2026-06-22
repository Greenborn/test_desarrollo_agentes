export function up(knex) {
  return knex.schema.createTable('project_variables', (table) => {
    table.increments('id');
    table.string('proyecto_id', 255).notNullable().references('id').inTable('proyectos').onDelete('CASCADE');
    table.string('key', 255).notNullable();
    table.text('value').notNullable().defaultTo('');
    table.timestamp('created_at').defaultTo(knex.fn.now());
    table.timestamp('updated_at').defaultTo(knex.fn.now());
    table.unique(['proyecto_id', 'key']);
  });
}

export function down(knex) {
  return knex.schema.dropTableIfExists('project_variables');
}
