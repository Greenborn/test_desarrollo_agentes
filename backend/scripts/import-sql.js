import dotenv from 'dotenv';
import { spawnSync } from 'child_process';
import fs from 'fs';
import path from 'path';
import readline from 'readline';

const __dirname = path.dirname(new URL(import.meta.url).pathname);

dotenv.config({ path: path.resolve(__dirname, '../.env') });

const host = process.env.DB_HOST;
const port = process.env.DB_PORT;
const appUser = process.env.DB_USER;
const appPass = process.env.DB_PASSWORD;
const dbName = process.env.DB_NAME;

if (!host || !port || !appUser || !dbName) {
  console.error('Faltan variables de entorno DB_HOST, DB_PORT, DB_USER, DB_PASSWORD, DB_NAME en .env');
  process.exit(1);
}

const uploadsDir = path.resolve(__dirname, '../../uploads');

if (!fs.existsSync(uploadsDir)) {
  console.error(`No existe el directorio de uploads: ${uploadsDir}`);
  process.exit(1);
}

const sqlFiles = fs.readdirSync(uploadsDir)
  .filter(f => f.endsWith('.sql'))
  .sort();

if (sqlFiles.length === 0) {
  console.error(`No se encontraron archivos .sql en ${uploadsDir}`);
  process.exit(1);
}

console.log('Archivos .sql disponibles:\n');
sqlFiles.forEach((f, i) => {
  const filePath = path.join(uploadsDir, f);
  const size = (fs.statSync(filePath).size / 1024 / 1024).toFixed(2);
  console.log(`  ${i + 1}. ${f} (${size} MB)`);
});

const rl = readline.createInterface({ input: process.stdin, output: process.stdout });

function promptChoice() {
  rl.question('\nSelecciona un número para importar (o q para salir): ', (answer) => {
    if (answer.toLowerCase() === 'q') {
      console.log('Cancelado.');
      rl.close();
      process.exit(0);
    }
    const idx = parseInt(answer, 10) - 1;
    if (isNaN(idx) || idx < 0 || idx >= sqlFiles.length) {
      console.log('Selección inválida.');
      promptChoice();
      return;
    }
    const chosen = sqlFiles[idx];
    const filePath = path.join(uploadsDir, chosen);
    rl.question(`\n¿Importar "${chosen}"? Se eliminará la base de datos actual y se reemplazará. (s/N): `, (confirm) => {
      if (confirm.toLowerCase() !== 's') {
        console.log('Cancelado.');
        rl.close();
        process.exit(0);
      }
      rl.close();
      importSql(filePath);
    });
  });
}

function importSql(filePath) {
  console.log(`\nImportando ${path.basename(filePath)}...\n`);

  console.log('Eliminando base de datos existente...');
  runMysql(`DROP DATABASE IF EXISTS \`${dbName}\``);
  console.log('✓ Base de datos eliminada.');

  console.log('Creando base de datos...');
  runMysql(`CREATE DATABASE \`${dbName}\` CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci`);
  console.log('✓ Base de datos creada.');

  console.log('\nImportando datos... (esto puede tardar)');
  const args = ['-u', appUser, `-p${appPass}`, dbName];
  if (host !== 'localhost') {
    args.unshift('-h', host, '-P', port);
  }
  const input = fs.readFileSync(filePath);
  const result = spawnSync('mysql', args, { stdio: ['pipe', 'inherit', 'inherit'], input });
  if (result.error) {
    console.error('Error:', result.error.message);
    process.exit(1);
  }
  if (result.status !== 0) {
    process.exit(result.status);
  }
  console.log(`\n✓ Importación de "${path.basename(filePath)}" completada.`);
}

function runMysql(sql) {
  const args = ['-u', appUser, `-p${appPass}`, '-e', sql];
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

promptChoice();
