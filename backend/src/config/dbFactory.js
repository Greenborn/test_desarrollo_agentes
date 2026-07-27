import knex from 'knex';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const backendDir = path.resolve(__dirname, '../../');

export function createDb(dbName, envVarName) {
  const envPath = process.env[envVarName];
  const dbPath = envPath
    ? path.resolve(backendDir, envPath)
    : path.resolve(backendDir, `../data/${dbName}.db`);

  const migrationsDir = path.resolve(backendDir, `./migrations_${dbName}`);

  return knex({
    client: 'better-sqlite3',
    connection: { filename: dbPath },
    useNullAsDefault: true,
    pool: {
      afterCreate: (conn, cb) => {
        conn.pragma('foreign_keys = OFF');
        cb();
      },
    },
    migrations: {
      directory: migrationsDir,
      extension: 'js',
    },
  });
}

export async function runMigrations(dbs) {
  for (const [label, instance] of Object.entries(dbs)) {
    console.log(`[migrate] Ejecutando migraciones de ${label}...`);
    await instance.migrate.latest();
    console.log(`[migrate] Migraciones de ${label} ejecutadas.`);
  }
}
