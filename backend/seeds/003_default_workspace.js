export async function seed(knex) {
  const existing = await knex('workspaces').where({ id: 1 }).first();
  if (!existing) {
    await knex('workspaces').insert({ id: 1, name: 'Por Defecto' });
  }
  await knex.raw('ALTER TABLE workspaces AUTO_INCREMENT = 2');
}
