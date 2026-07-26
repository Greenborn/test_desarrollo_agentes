import 'dotenv/config';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

const sqlitePath = process.env.DB_COMANDOS_SQLITE_PATH
  ? path.resolve(__dirname, process.env.DB_COMANDOS_SQLITE_PATH)
  : path.resolve(__dirname, '../data/comandos.db');

const config = {
  client: 'better-sqlite3',
  connection: {
    filename: sqlitePath,
  },
  useNullAsDefault: true,
  migrations: {
    directory: './migrations_comandos',
    extension: 'js',
  },
};

export default config;
