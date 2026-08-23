import { spawn } from 'child_process';
import db from '../config/db.js';
import dbComandos from '../config/dbComandos.js';
import dbProjectVariables from '../config/dbProjectVariables.js';
import memoriaClient from './memoriaClient.js';

// Lógica compartida de comandos personalizados del proyecto. La usan tanto las rutas
// HTTP (`comandosPersonalizados.routes.js`) como la interfaz remota (pseudoendpoints
// `interfaz-remota:listComandos` y `interfaz-remota:ejecutarComando`) para no duplicar
// la resolución de variables ni la ejecución del shell.

export async function obtenerComandoPersonalizado(comandoId) {
  return dbComandos('comandos_personalizados_proyectos').where({ id: comandoId }).first();
}

export async function listarComandosPorProyecto(proyectoId) {
  if (!proyectoId) return [];
  return dbComandos('comandos_personalizados_proyectos')
    .where({ id_proyecto: proyectoId })
    .orderBy('label', 'asc')
    .select('*');
}

// Resuelve el comando shell reemplazando variables `{{key}}` del proyecto y fijando el
// cwd de la sesión (o process.cwd() si la sesión no define cwd).
export async function resolverComando(comando, sessionId) {
  let cwd = process.cwd();
  if (sessionId) {
    const session = await db('chat_sessions').where({ id: sessionId }).select('cwd').first();
    if (session && session.cwd) cwd = session.cwd;
  }

  let shellCommand = comando.comando;
  if (comando.id_proyecto && shellCommand.includes('{{')) {
    try {
      const dbVariables = await dbProjectVariables('project_variables')
        .select('key', 'value', 'type')
        .where({ proyecto_id: comando.id_proyecto });

      const variableMap = {};
      const memoryNamespace = `proyecto:${comando.id_proyecto}`;

      for (const v of dbVariables) {
        if (v.type === 'memory') {
          try {
            const memResult = await memoriaClient.get(memoryNamespace, v.key);
            variableMap[v.key] = memResult.value;
          } catch (err) {
            console.log('[comandosPersonalizados] Error al obtener variable de memoria:', err.message);
            variableMap[v.key] = '';
          }
        } else {
          variableMap[v.key] = v.value;
        }
      }

      shellCommand = shellCommand.replace(/\{\{(.+?)\}\}/g, (match, key) => {
        return key in variableMap ? variableMap[key] : match;
      });
    } catch (err) {
      console.log('Error al resolver variables para comando personalizado:', err.message);
    }
  }

  return { shellCommand, cwd };
}

// Ejecuta un comando shell y acumula su salida (stdout + stderr) en memoria.
// Pensado para transporte que no soporta streaming (pseudoendpoints socket.io).
export function ejecutarShellBuffered(shellCommand, cwd) {
  return new Promise((resolve) => {
    let output = '';
    let success = true;

    const proc = spawn('/bin/sh', ['-c', shellCommand], {
      cwd,
      env: { ...process.env },
      stdio: ['ignore', 'pipe', 'pipe'],
    });

    proc.stdout.on('data', (data) => {
      output += data.toString();
    });

    proc.stderr.on('data', (data) => {
      output += data.toString();
    });

    proc.on('error', (err) => {
      console.log('[comandosPersonalizados] error al lanzar proceso:', err.message);
      success = false;
      output += `\n[Error: ${err.message}]`;
      resolve({ success, output });
    });

    proc.on('exit', (code) => {
      if (code !== 0) success = false;
      resolve({ success, output });
    });
  });
}

// Resuelve y ejecuta un comando personalizado por su id. Devuelve el output completo
// y la bandera `ocultarEjecucion` para que el consumidor decida cómo presentarlo.
export async function ejecutarComandoPersonalizado(comandoId, sessionId) {
  const comando = await obtenerComandoPersonalizado(comandoId);
  if (!comando) throw new Error('Comando personalizado no encontrado');

  const { shellCommand, cwd } = await resolverComando(comando, sessionId);
  const res = await ejecutarShellBuffered(shellCommand, cwd);

  return {
    success: res.success,
    output: res.output && res.output.length > 0 ? res.output : '(sin salida)',
    ocultarEjecucion: comando.ocultar_ejecucion ? true : false,
    shellCommand,
  };
}
