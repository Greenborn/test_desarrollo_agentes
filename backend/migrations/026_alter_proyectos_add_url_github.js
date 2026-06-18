export async function up(knex) {
  const hasUrlGithub = await knex.schema.hasColumn('proyectos', 'url_github');
  if (!hasUrlGithub) {
    await knex.schema.alterTable('proyectos', (table) => {
      table.string('url_github', 500).nullable();
    });
  }
}

export async function down(knex) {
  const hasUrlGithub = await knex.schema.hasColumn('proyectos', 'url_github');
  if (hasUrlGithub) {
    await knex.schema.alterTable('proyectos', (table) => {
      table.dropColumn('url_github');
    });
  }
}
