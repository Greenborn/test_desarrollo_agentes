import dbProjectVariables from '../config/dbProjectVariables.js';
import memoriaClient from './memoriaClient.js';

// Crea una variable común a un proyecto.
// Usado por la ruta HTTP POST /proyecto/:id/variables y por el CLI (src/cli/index.js).
// Devuelve { ok: true } o { ok: false, status, error } para que el llamador decida la respuesta.
export async function crearVariableProyecto({ proyectoId, key, value, type }) {
  const pid = String(proyectoId);
  const varType = type === 'memory' ? 'memory' : 'db';

  const existing = await dbProjectVariables('project_variables')
    .where({ proyecto_id: pid, key })
    .first();
  if (existing) {
    return { ok: false, status: 409, error: `La variable "${key}" ya existe en este proyecto` };
  }

  if (varType === 'memory') {
    await dbProjectVariables('project_variables').insert({
      proyecto_id: pid,
      key,
      value: '',
      type: 'memory',
    });
    const memNamespace = `proyecto:${pid}`;
    await memoriaClient.set(memNamespace, key, value);
  } else {
    await dbProjectVariables('project_variables').insert({
      proyecto_id: pid,
      key,
      value: String(value),
      type: 'db',
    });
  }

  return { ok: true };
}
