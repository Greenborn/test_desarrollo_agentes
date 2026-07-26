export async function seed(knex) {
  const existing = await knex('workspaces').where({ id: 1 }).first();
  if (!existing) {
    await knex('workspaces').insert({ id: 1, name: 'Por Defecto', color: '#75AADB', slug: 'por_defecto_1' });
  }
}
