export function up(knex) {
  return knex.schema.createTable('proyectos', (table) => {
    table.string('id', 255).primary();
    table.integer('workspace_id').unsigned().notNullable().defaultTo(1);
    table.text('descripcion').notNullable();
    table.integer('redmine_id').notNullable();
    table.integer('redmine_status').nullable();
    table.datetime('redmine_created_on').nullable();
    table.datetime('redmine_updated_on').nullable();
    table.string('redmine_parent_id', 255).nullable();
    table.string('redmine_parent_name', 255).nullable();
    table.string('url_github', 500).nullable();
    table.string('color', 7).defaultTo('#6b7280');
    table.text('despliegue_config').nullable();
    table.timestamp('created_at').defaultTo(knex.fn.now());
    table.unique(['redmine_id', 'workspace_id']);
  });
}

export function down(knex) {
  return knex.schema.dropTableIfExists('proyectos');
}
