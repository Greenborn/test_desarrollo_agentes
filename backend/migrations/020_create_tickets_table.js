export function up(knex) {
  return knex.schema.createTable('tickets', (table) => {
    table.increments('id');
    table.string('proyecto_id', 255).notNullable().references('id').inTable('proyectos').onDelete('CASCADE');
    table.integer('redmine_id').notNullable().unique();
    table.string('subject', 500).notNullable();
    table.text('description').nullable();
    table.string('status_name', 100).nullable();
    table.string('tracker_name', 100).nullable();
    table.string('priority_name', 100).nullable();
    table.string('assigned_to_name', 255).nullable();
    table.string('author_name', 255).nullable();
    table.date('start_date').nullable();
    table.date('due_date').nullable();
    table.decimal('estimated_hours', 10, 2).nullable();
    table.integer('done_ratio').nullable();
    table.string('fixed_version_name', 255).nullable();
    table.datetime('redmine_created_on').nullable();
    table.datetime('redmine_updated_on').nullable();
    table.datetime('redmine_closed_on').nullable();
  });
}

export function down(knex) {
  return knex.schema.dropTableIfExists('tickets');
}
