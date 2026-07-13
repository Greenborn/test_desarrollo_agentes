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
  db = knex({
    client: 'mysql2',
    connection: {
      host: process.env.DB_HOST || 'localhost',
      port: parseInt(process.env.DB_PORT, 10) || 3306,
      user: process.env.DB_USER,
      password: process.env.DB_PASSWORD,
      database: process.env.DB_NAME,
    },
    pool: { min: 0, max: 5 },
  });
  browserManager.setDb(db);
} catch (err) {
  console.log('[playwright] No se pudo conectar a la base de datos, los logs de red/consola no se guardarán:', err.message);
}

const app = express();
app.use(express.json({ limit: '200mb' }));

app.use('/api', commandRoutes);

function killPort(port) {
  try {
    execSync(`fuser -k ${port}/tcp 2>/dev/null || lsof -ti :${port} | xargs kill -9 2>/dev/null`, { stdio: 'ignore' });
  } catch (err) {
    console.log('[playwright] Error al matar puerto:', err.message);
  }
}
killPort(PORT);

const server = app.listen(PORT, (err) => {
  if (err) {
    console.log('Error al iniciar servidor playwright:', err.message);
    process.exit(1);
  }
  console.log(`Playwright service listening on port ${PORT}`);
});
