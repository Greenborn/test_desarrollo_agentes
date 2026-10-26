// CLI de consola del sistema: se ejecuta desde una terminal externa, sin pasar por HTTP ni cookie de sesión.
// Uso: npm run cli -- <grupo> <accion> [opciones]
import 'dotenv/config';
import { parseArgs } from 'node:util';
import db from '../config/db.js';
import dbRedmineData from '../config/dbRedmineData.js';
import { crearVariableProyecto } from '../services/projectVariables.service.js';

const TIPOS_VARIABLE = ['db', 'memory'];

function fallo(mensaje) {
  console.error(`Error: ${mensaje}`);
  return 1;
}

async function variableAgregar(argv) {
  const { values } = parseArgs({
    args: argv,
    options: {
      sesion: { type: 'string' },
      key: { type: 'string' },
      value: { type: 'string' },
      tipo: { type: 'string' },
    },
    strict: true,
  });

  if (values.sesion === undefined) return fallo('--sesion es requerido');
  if (values.key === undefined) return fallo('--key es requerido');
  if (values.value === undefined) return fallo('--value es requerido');

  const sesionId = Number(values.sesion);
  if (!Number.isInteger(sesionId)) return fallo(`--sesion debe ser un id numérico, se recibió "${values.sesion}"`);

  const tipo = values.tipo === undefined ? 'db' : values.tipo;
  if (!TIPOS_VARIABLE.includes(tipo)) return fallo(`--tipo debe ser uno de: ${TIPOS_VARIABLE.join(', ')}`);

  const sesion = await db('chat_sessions').where({ id: sesionId }).select('proyecto_id').first();
  if (!sesion) return fallo(`Sesión de chat ${sesionId} no encontrada`);
  if (!sesion.proyecto_id) return fallo(`La sesión ${sesionId} no tiene proyecto asignado`);

  const proyecto = await dbRedmineData('proyectos').select('id').where({ id: sesion.proyecto_id }).first();
  if (!proyecto) return fallo(`Proyecto ${sesion.proyecto_id} no encontrado`);

  const resultado = await crearVariableProyecto({
    proyectoId: sesion.proyecto_id,
    key: values.key,
    value: values.value,
    type: tipo,
  });
  if (!resultado.ok) return fallo(resultado.error);

  console.log(`Variable "${values.key}" (${tipo}) agregada al proyecto ${sesion.proyecto_id}`);
  return 0;
}

const COMANDOS = {
  'variable agregar': {
    descripcion: 'Agrega una variable común al proyecto asignado a una sesión de chat',
    uso: 'npm run cli -- variable agregar --sesion <id> --key <clave> --value <valor> [--tipo db|memory]',
    ejecutar: variableAgregar,
  },
};

function mostrarAyuda() {
  console.log('Uso: npm run cli -- <grupo> <accion> [opciones]\n');
  console.log('Comandos disponibles:');
  for (const [nombre, cmd] of Object.entries(COMANDOS)) {
    console.log(`  ${nombre}\n      ${cmd.descripcion}\n      ${cmd.uso}`);
  }
}

async function main() {
  const [grupo, accion, ...resto] = process.argv.slice(2);
  if (grupo === undefined || grupo === 'ayuda' || grupo === '--help') {
    mostrarAyuda();
    return 0;
  }
  const nombre = `${grupo} ${accion}`;
  const comando = COMANDOS[nombre];
  if (accion === undefined || !comando) {
    console.error(`Comando desconocido: "${nombre}"`);
    mostrarAyuda();
    return 1;
  }
  return comando.ejecutar(resto);
}

main()
  .then((codigo) => {
    // Las conexiones de Knex y el WebSocket de memoria mantienen el proceso abierto: cerrar explícitamente.
    process.exit(codigo);
  })
  .catch((err) => {
    console.error('Error al ejecutar el comando:', err.message);
    process.exit(1);
  });
