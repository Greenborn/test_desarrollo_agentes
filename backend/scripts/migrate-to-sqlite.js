import 'dotenv/config';
import path from 'path';
import fs from 'fs';
import { fileURLToPath } from 'url';
import knex from 'knex';
import { createSchema } from '../src/config/sqliteSchema.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

const MIGRATIONS_DIR = path.resolve(__dirname, '../migrations');

const BATCH_SIZE = 500;

const TABLE_ORDER = [
  'workspaces',
  'users',
  'templates',
  'global_settings',
  'chat_sessions',
  'settings',
  'user_settings',
  'proyectos',
  'command_history',
  'chat_messages',
  'funcionalidades',
  'gastos_tokens_usados',
  'tickets',
  'project_variables',
  'workspace_environments',
  'documentacion_escaneo',
  'documentacion_archivo',
  'documentacion_notas',
  'documentacion_base_datos',
  'documentacion_subproyectos',
  'documentacion_endpoints',
  'documentacion_web_sockets',
  'documentacion_funcionalidades',
  'playwright_console_logs',
  'playwright_network_logs',
  'playwright_event_recordings',
  'playwright_events',
  'redmine_comentarios',
  'comandos_personalizados_proyectos',
  'archivos',
  'capturas_metadata',
];

const JSON_COLUMNS_BY_TABLE = {
  documentacion_base_datos: ['data'],
  documentacion_subproyectos: ['data'],
  documentacion_endpoints: ['data'],
  documentacion_web_sockets: ['data'],
  documentacion_funcionalidades: ['data'],
  funcionalidades: ['parametros'],
  proyectos: ['despliegue_config'],
  settings: ['setting_value'],
  global_settings: ['setting_value'],
};

function validateRequiredMariaVars() {
  const required = ['DB_HOST', 'DB_PORT', 'DB_USER', 'DB_PASSWORD', 'DB_NAME'];
  for (const key of required) {
    if (!process.env[key]) {
      console.error(`Falta ${key} en .env — necesaria para MariaDB origen`);
      process.exit(1);
    }
  }
}

function getSqlitePath() {
  if (process.env.DB_SQLITE_PATH) {
    return path.resolve(__dirname, '..', process.env.DB_SQLITE_PATH);
  }
  return path.resolve(__dirname, '../../data/app.db');
}

function ensureDir(filePath) {
  const dir = path.dirname(filePath);
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }
}

async function getMigrationFiles() {
  const files = fs.readdirSync(MIGRATIONS_DIR)
    .filter(f => f.endsWith('.js'))
    .sort();
  return files;
}

async function batchInsert(knexInstance, table, rows) {
  if (!rows.length) return;
  for (let i = 0; i < rows.length; i += BATCH_SIZE) {
    const batch = rows.slice(i, i + BATCH_SIZE);
    await knexInstance(table).insert(batch);
  }
}

async function migrate() {
  console.log('=== Migración MariaDB → SQLite ===\n');

  validateRequiredMariaVars();

  const sqlitePath = getSqlitePath();
  console.log(`Archivo destino SQLite: ${sqlitePath}`);

  if (fs.existsSync(sqlitePath)) {
    console.error(`ERROR: Ya existe un archivo SQLite en ${sqlitePath}`);
    console.error('Eliminalo manualmente o movelo antes de migrar.');
    process.exit(1);
  }

  ensureDir(sqlitePath);

  const source = knex({
    client: 'mysql2',
    connection: {
      host: process.env.DB_HOST,
      port: parseInt(process.env.DB_PORT),
      user: process.env.DB_USER,
      password: process.env.DB_PASSWORD,
      database: process.env.DB_NAME,
    },
  });

  const dest = knex({
    client: 'better-sqlite3',
    connection: { filename: sqlitePath },
    useNullAsDefault: true,
  });

  try {
    await source.raw('SELECT 1');
    console.log('✓ Conexión MariaDB OK');
  } catch (err) {
    console.error('✗ Error conectando a MariaDB:', err.message);
    console.error('Asegurate de que MariaDB esté corriendo y las credenciales en .env sean correctas.');
    process.exit(1);
  }

  try {
    console.log('\nCreando schema en SQLite...');
    await createSchema(dest);
  } catch (err) {
    console.error('✗ Error creando schema SQLite:', err.message);
    process.exit(1);
  }

  let totalMigrated = 0;
  let errors = [];

  for (const table of TABLE_ORDER) {
    try {
      const [{ count }] = await source(table).count('* as count');
      const rowCount = Number(count);

      if (rowCount === 0) {
        console.log(`  ${table}: 0 filas (sin datos)`);
        continue;
      }

      const jsonColumns = JSON_COLUMNS_BY_TABLE[table] || [];

      const rows = [];
      let offset = 0;

      while (offset < rowCount) {
        const batch = await source(table)
          .select('*')
          .orderByRaw('(SELECT 1)')
          .limit(BATCH_SIZE)
          .offset(offset);

        if (!batch.length) break;

        for (const row of batch) {
          const clean = {};
          for (const [key, value] of Object.entries(row)) {
            if (jsonColumns.includes(key) && value !== null && typeof value === 'object') {
              clean[key] = JSON.stringify(value);
            } else {
              clean[key] = value;
            }
          }
          rows.push(clean);
        }

        offset += BATCH_SIZE;
      }

      await batchInsert(dest, table, rows);
      totalMigrated += rowCount;
      console.log(`  ${table}: ${rowCount} filas migradas`);
    } catch (err) {
      console.log(`  ${table}: ERROR — ${err.message}`);
      errors.push({ table, error: err.message });
    }
  }

  console.log(`\n✓ Migración completada: ${totalMigrated} filas totales en ${TABLE_ORDER.length} tablas`);

  if (errors.length) {
    console.log(`\n⚠ ${errors.length} tabla(s) con errores:`);
    for (const e of errors) {
      console.log(`  - ${e.table}: ${e.error}`);
    }
  }

  console.log('\nCopiando estado de knex_migrations...');
  try {
    const allMigrationsRows = await source('knex_migrations').select('*');
    const migrationFiles = await getMigrationFiles();
    const validNames = new Set(migrationFiles);

    const migrationsRows = allMigrationsRows.filter(r => validNames.has(r.name));
    const skipped = allMigrationsRows.length - migrationsRows.length;

    if (skipped > 0) {
      console.log(`  ⚠ ${skipped} migración(es) omitidas (no existen en el filesystem):`);
      for (const r of allMigrationsRows) {
        if (!validNames.has(r.name)) {
          console.log(`    - ${r.name}`);
        }
      }
    }

    if (migrationsRows.length) {
      const existing = await dest.schema.hasTable('knex_migrations');
      if (!existing) {
        await dest.schema.createTable('knex_migrations', (table) => {
          table.increments('id');
          table.string('name', 255).nullable();
          table.integer('batch').nullable();
          table.timestamp('migration_time').nullable();
        });
      }
      await batchInsert(dest, 'knex_migrations', migrationsRows);
      console.log(`  ✓ ${migrationsRows.length} migraciones registradas`);
    }
  } catch (err) {
    console.log('  ⚠ No se pudieron copiar las migraciones:', err.message);
  }

  const migrationFiles = await getMigrationFiles();
  const existingMigrations = await dest('knex_migrations').select('name');
  const existingNames = new Set(existingMigrations.map(r => r.name));
  const pending = migrationFiles.filter(f => !existingNames.has(f));

  if (pending.length) {
    console.log(`  ⚠ ${pending.length} migración(es) pendiente(s) (no estaban en knex_migrations de origen):`);
    for (const f of pending) {
      console.log(`    - ${f}`);
    }
    console.log('\n  Podés registrar las migraciones pendientes manualmente');
    console.log('  o ejecutar: npx knex migrate:latest');
  }

  console.log('\nConfigurando knex_migrations_lock...');
  try {
    const lockExists = await dest.schema.hasTable('knex_migrations_lock');
    if (!lockExists) {
      await dest.schema.createTable('knex_migrations_lock', (table) => {
        table.integer('index').primary();
        table.integer('is_locked').nullable();
      });
    }
    const existingLock = await dest('knex_migrations_lock').select('*');
    if (!existingLock.length) {
      await dest('knex_migrations_lock').insert({ index: 1, is_locked: 0 });
    }
  } catch (err) {
    console.log('  ⚠ No se pudo configurar knex_migrations_lock:', err.message);
  }

  console.log('\nDeshabilitando chequeo de claves foráneas para integridad de datos existentes...');
  try {
    await dest.raw('PRAGMA foreign_keys = OFF');
    console.log('  ✓ PRAGMA foreign_keys = OFF');
  } catch (err) {
    console.log('  ⚠ No se pudo configurar PRAGMA:', err.message);
  }

  console.log('\n=== Verificación de integridad ===');
  let verified = 0;
  let mismatches = [];

  for (const table of TABLE_ORDER) {
    try {
      const [{ srcCount }] = await source(table).count('* as srcCount');
      const [{ dstCount }] = await dest(table).count('* as dstCount');
      const srcNum = Number(srcCount);
      const dstNum = Number(dstCount);

      if (srcNum !== dstNum) {
        mismatches.push({ table, source: srcNum, dest: dstNum });
        console.log(`  ✗ ${table}: ${srcNum} → ${dstNum} (DIFERENCIA!)`);
      } else {
        console.log(`  ✓ ${table}: ${srcNum} → ${dstNum}`);
        verified++;
      }
    } catch (err) {
      console.log(`  ? ${table}: no se pudo verificar: ${err.message}`);
    }
  }

  console.log(`\n=== Resumen ===`);
  console.log(`Tablas verificadas OK: ${verified}/${TABLE_ORDER.length}`);
  if (mismatches.length) {
    console.log(`\n⚠ ${mismatches.length} tabla(s) con diferencias:`);
    for (const m of mismatches) {
      console.log(`  - ${m.table}: MariaDB ${m.source} → SQLite ${m.dest}`);
    }
  }
  console.log(`\nArchivo SQLite: ${sqlitePath}`);
  console.log(`\nPara usar SQLite, configurá en .env:\n  DB_DRIVER=sqlite\n  DB_SQLITE_PATH=${process.env.DB_SQLITE_PATH || '../data/app.db'}\n`);

  await source.destroy();
  await dest.destroy();
}

migrate().catch((err) => {
  console.error('Error fatal:', err.message);
  process.exit(1);
});
