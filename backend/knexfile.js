import 'dotenv/config';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

const sqlitePath = process.env.DB_SQLITE_PATH
  ? path.resolve(__dirname, process.env.DB_SQLITE_PATH)
  : path.resolve(__dirname, '../data/app.db');

const config = {
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

export default config;
