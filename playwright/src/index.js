import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';
import { execSync } from 'child_process';
import express from 'express';
import knex from 'knex';
import commandRoutes from './routes/command.routes.js';
import browserManager from './services/browserManager.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

dotenv.config({ path: path.resolve(__dirname, '../../backend/.env') });

const PORT = process.env.SERVICIO_PLAYWRIGHT_PORT;
if (!PORT) {
  console.log('SERVICIO_PLAYWRIGHT_PORT no está definido en .env');
  process.exit(1);
}

let db = null;
try {
  const sqlitePath = process.env.DB_PLAYWRIGHT_SQLITE_PATH
    ? path.resolve(__dirname, '../../', process.env.DB_PLAYWRIGHT_SQLITE_PATH)
    : path.resolve(__dirname, '../../data/playwright.db');

  db = knex({
    client: 'better-sqlite3',
    connection: { filename: sqlitePath },
    useNullAsDefault: true,
  });
  browserManager.setDb(db);
} catch (err) {
  console.log('[playwright] No se pudo conectar a la base de datos playwright, los logs de red/consola no se guardarán:', err.message);
}

const app = express();
app.use(express.json({ limit: '200mb' }));

app.use('/api', commandRoutes);

function killPort(port) {
  try {
    execSync(`fuser -k -TERM ${port}/tcp 2>/dev/null`, { stdio: 'ignore', timeout: 5000 });
    execSync(`sleep 2`, { stdio: 'ignore', timeout: 5000 });
    execSync(`fuser -k -KILL ${port}/tcp 2>/dev/null || lsof -ti :${port} | xargs kill -9 2>/dev/null || true`, { stdio: 'ignore', timeout: 5000 });
    execSync(`sleep 1`, { stdio: 'ignore', timeout: 5000 });
    const remain = execSync(`fuser ${port}/tcp 2>/dev/null || lsof -ti :${port} 2>/dev/null || true`, { encoding: 'utf8', timeout: 5000 }).toString().trim();
    if (remain) {
      console.log('[playwright] AVISO: Puerto', port, 'aún ocupado por:', remain);
    }
  } catch (err) {
    console.log('[playwright] Error al cerrar puerto', port, ':', err.message);
  }
}
killPort(PORT);

process.on('uncaughtException', (err, origin) => {
  console.log('[playwright] UNCAUGHT EXCEPTION:', err.message, '\n', err.stack, '\norigin:', origin);
});

process.on('unhandledRejection', (reason, promise) => {
  console.log('[playwright] UNHANDLED REJECTION:', reason instanceof Error ? reason.message : reason, '\n', reason instanceof Error ? reason.stack : '');
});

const server = app.listen(PORT, (err) => {
  if (err) {
    console.log('Error al iniciar servidor playwright:', err.message);
    process.exit(1);
  }
  console.log(`Playwright service listening on port ${PORT}`);
});
