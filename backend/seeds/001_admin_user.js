import bcrypt from 'bcrypt';

export async function seed(knex) {
  const hash = await bcrypt.hash('admin', 10);
  await knex('users').del();
  await knex('users').insert({ username: 'admin', password_hash: hash, role: 'admin' });
}
