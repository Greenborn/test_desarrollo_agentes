export async function seed(knex) {
  const existing = await knex('workspace_environments').where({ workspace_id: 1 }).first();
  if (existing) return;

  await knex('workspace_environments').insert([
    { workspace_id: 1, name: 'DEV', branch: 'DEV', description: 'Desarrollo' },
    { workspace_id: 1, name: 'TST', branch: 'TST', description: 'Testing' },
    { workspace_id: 1, name: 'PRD', branch: 'PRD', description: 'Producción' },
  ]);
}
