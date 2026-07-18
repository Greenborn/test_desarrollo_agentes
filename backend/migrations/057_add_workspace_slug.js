export async function up(knex) {
  await knex.schema.alterTable('workspaces', (table) => {
    table.string('slug', 255);
  });

  const workspaces = await knex('workspaces').select('id', 'name');
  for (const ws of workspaces) {
    const base = ws.name
      .toLowerCase()
      .replace(/[^a-z0-9 ]/g, '')
      .replace(/ /g, '_')
      .replace(/_+/g, '_')
      .replace(/^_|_$/g, '');
    const slug = base + '_' + ws.id;
    await knex('workspaces').where({ id: ws.id }).update({ slug });
  }

  await knex.schema.alterTable('workspaces', (table) => {
    table.string('slug', 255).notNullable().unique().alter();
  });
}

export async function down(knex) {
  await knex.schema.alterTable('workspaces', (table) => {
    table.dropColumn('slug');
  });
}
