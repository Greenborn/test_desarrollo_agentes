import bcrypt from 'bcrypt';

export async function seed(knex) {
  const hash = await bcrypt.hash('admin', 10);
  await knex('users')
    .insert({ username: 'admin', password_hash: hash, role: 'admin' })
    .onConflict('username')
    .merge(['password_hash', 'role']);
}
