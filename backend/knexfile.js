import 'dotenv/config';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

const isSqlite = process.env.DB_DRIVER === 'sqlite';

let config;

if (isSqlite) {
  const sqlitePath = process.env.DB_SQLITE_PATH
    ? path.resolve(__dirname, process.env.DB_SQLITE_PATH)
    : path.resolve(__dirname, '../data/app.db');

  config = {
    client: 'better-sqlite3',
    connection: {
      filename: sqlitePath,
    },
    useNullAsDefault: true,
    migrations: {
      directory: './migrations',
      extension: 'js',
    },
    seeds: {
      directory: './seeds',
      extension: 'js',
    },
  };
} else {
  const required = ['DB_HOST', 'DB_PORT', 'DB_USER', 'DB_PASSWORD', 'DB_NAME'];
  for (const key of required) {
    if (!process.env[key]) {
      console.log(`Falta ${key} en .env`);
      process.exit(1);
    }
  }

  config = {
    client: 'mysql2',
    connection: {
      host: process.env.DB_HOST,
      port: parseInt(process.env.DB_PORT),
      user: process.env.DB_USER,
      password: process.env.DB_PASSWORD,
      database: process.env.DB_NAME,
    },
    migrations: {
      directory: './migrations',
      extension: 'js',
    },
    seeds: {
      directory: './seeds',
      extension: 'js',
    },
  };
}

export default config;
