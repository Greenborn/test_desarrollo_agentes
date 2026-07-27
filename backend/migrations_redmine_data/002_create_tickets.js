export function up(knex) {
  return knex.schema.createTable('tickets', (table) => {
    table.increments('id').primary();
    table.integer('workspace_id').unsigned().notNullable().defaultTo(1);
    table.string('proyecto_id', 255).notNullable();
    table.integer('redmine_id').notNullable();
    table.string('subject', 500).notNullable();
    table.text('description', 'longtext').nullable();
    table.string('status_name', 100).nullable();
    table.string('tracker_name', 100).nullable();
    table.integer('priority_id').nullable();
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
    table.timestamp('created_at').defaultTo(knex.fn.now());
    table.unique(['redmine_id', 'workspace_id']);
  });
}

export function down(knex) {
  return knex.schema.dropTableIfExists('tickets');
}
