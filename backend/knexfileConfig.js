import 'dotenv/config';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

const sqlitePath = process.env.DB_CONFIG_SQLITE_PATH
  ? path.resolve(__dirname, process.env.DB_CONFIG_SQLITE_PATH)
  : path.resolve(__dirname, '../data/config.db');

const config = {
  client: 'better-sqlite3',
  connection: {
    filename: sqlitePath,
  },
  useNullAsDefault: true,
  migrations: {
    directory: './migrations_config',
    extension: 'js',
  },
};

export default config;
