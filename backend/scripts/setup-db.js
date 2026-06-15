import 'dotenv/config';
import { spawnSync } from 'child_process';

const host = process.env.DB_HOST;
const port = process.env.DB_PORT;
const appUser = process.env.DB_USER;
const appPass = process.env.DB_PASSWORD;
const dbName = process.env.DB_NAME;

if (!host || !port || !appUser || !dbName) {
  console.error('Faltan variables de entorno DB_HOST, DB_PORT, DB_USER, DB_PASSWORD, DB_NAME en .env');
  process.exit(1);
}

if (process.getuid?.() !== 0) {
  console.error('Este script debe ejecutarse como root. Usá: sudo npm run setup-db');
  process.exit(1);
}

function runMysql(sql) {
  const args = ['-e', sql];
  if (host !== 'localhost') args.unshift('-h', host, '-P', port);
  const result = spawnSync('mysql', args, { stdio: 'inherit' });
  if (result.error) {
    console.error('Error:', result.error.message);
    process.exit(1);
  }
  if (result.status !== 0) {
    process.exit(result.status);
  }
}

console.log('Creando base de datos y usuario...\n');

runMysql(`CREATE DATABASE IF NOT EXISTS \`${dbName}\` CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci`);
console.log(`✓ Base de datos '${dbName}' lista.`);

runMysql(`CREATE USER IF NOT EXISTS '${appUser}'@'%' IDENTIFIED BY '${appPass}'`);
runMysql(`GRANT ALL PRIVILEGES ON \`${dbName}\`.* TO '${appUser}'@'%'`);
runMysql('FLUSH PRIVILEGES');
console.log(`✓ Usuario '${appUser}' configurado.`);
