import fs from 'fs';
import { promises as fsp } from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { buildTree, countTreeFiles } from './fileTreeBuilder.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const projectDir = path.resolve(__dirname, '../..');

const STORAGE_DIR = process.env.ALMACENAMIENTO_DIR
  ? path.resolve(process.env.ALMACENAMIENTO_DIR)
  : path.resolve(projectDir, 'almacenamiento');

function ensureStorageDir() {
  if (!fs.existsSync(STORAGE_DIR)) {
    fs.mkdirSync(STORAGE_DIR, { recursive: true });
  }
}

ensureStorageDir();

// Confina `dir` (relativo o absoluto) dentro de STORAGE_DIR, igual que
// `backend/src/modules/almacenamiento/almacenamiento.routes.js` (resolveConfinedPath),
// del que esta versión es una copia: el directorio de almacenamiento compartido es
// alcanzable también desde la gestión interna remota.
function resolveConfinedPath(dir) {
  const base = STORAGE_DIR;
  const target = dir ? path.resolve(base, dir) : base;
  const realBase = fs.realpathSync(base);
  let realTarget;
  try {
    realTarget = fs.realpathSync(target);
  } catch (err) {
    realTarget = target;
  }
  if (realTarget !== realBase && !realTarget.startsWith(realBase + path.sep)) {
    return null;
  }
  return target;
}

export async function listarAlmacenamiento({ dir, depth, showHidden } = {}) {
  const targetDir = resolveConfinedPath(dir || '');
  if (!targetDir) return { success: false, error: 'Ruta fuera del directorio de almacenamiento' };
  if (!fs.existsSync(targetDir)) return { success: false, error: `El directorio '${targetDir}' no existe` };
  if (!fs.statSync(targetDir).isDirectory()) return { success: false, error: `'${targetDir}' no es un directorio` };
  try {
    const tree = await buildTree(targetDir, [], false, showHidden !== false, undefined, parseInt(depth, 10) || 0);
    const totalFiles = countTreeFiles(tree);
    return { success: true, data: { tree, totalFiles } };
  } catch (err) {
    console.log('[interfaz_remota] Error al listar almacenamiento:', err.message);
    return { success: false, error: err.message };
  }
}

// --- Subida por chunks ---
// El archivo se transporta por partes (varios pseudoendpoints en vez de uno solo con el
// contenido completo), para poder reportar progreso en el cliente y no depender de un
// único ACK de socket.io con el archivo entero adentro. Cada chunk puede venir en base64
// (compatibilidad con el emisor original) o como binario (Buffer/ArrayBuffer, que
// socket.io transporta nativamente): el binario evita el ~33% de overhead de base64,
// relevante cuando el archivo pesa cientos de GB.
//
// El file handle se abre una sola vez en `iniciar` y se mantiene abierto durante toda la
// subida, escribiendo cada chunk en su offset exacto (`receivedBytes`) en vez de reabrir
// el archivo en cada chunk (como hacía `fs.appendFileSync`): con archivos grandes (decenas
// de miles de chunks) reabrir el archivo por chunk es lento y, al ser todo síncrono,
// bloquea el event loop el tiempo suficiente como para perder los pings de socket.io y
// cortar la conexión a mitad de transferencia. Usar `fs/promises` evita ese bloqueo.
const MAX_UPLOAD_BYTES = Number(process.env.ALMACENAMIENTO_MAX_UPLOAD_BYTES) || 500 * 1024 * 1024 * 1024; // 500 GB
// Tamaño máximo aceptado para una sola parte. El emisor usa 512 KiB (base64 ~700 KB),
// pero se deja margen para clientes que envíen binario directo.
const MAX_CHUNK_BYTES = Number(process.env.ALMACENAMIENTO_MAX_CHUNK_BYTES) || 8 * 1024 * 1024;
// Tiempo de inactividad (sin chunks nuevos) tras el cual se descarta una subida a medio
// terminar. Se resetea en cada chunk recibido, así que no limita la duración total de la
// transferencia, solo cuánto puede quedar colgada sin avanzar.
const UPLOAD_TTL_MS = Number(process.env.ALMACENAMIENTO_UPLOAD_TTL_MS) || 30 * 60 * 1000;

const uploads = new Map();
let uploadIdCounter = 0;

function genUploadId() {
  uploadIdCounter += 1;
  return `up-${Date.now().toString(36)}-${uploadIdCounter}-${Math.random().toString(36).slice(2, 8)}`;
}

function formatBytes(bytes) {
  const gb = bytes / (1024 ** 3);
  if (gb >= 1) return `${gb % 1 === 0 ? gb : gb.toFixed(1)} GB`;
  return `${(bytes / (1024 ** 2)).toFixed(0)} MB`;
}

async function cerrarYDescartar(up) {
  uploads.delete(up.uploadId);
  if (up.fileHandle) {
    try { await up.fileHandle.close(); } catch (err) { console.log('[interfaz_remota] Error al cerrar handle de subida:', err.message); }
  }
  try {
    await fsp.unlink(up.tmpPath);
  } catch (err) {
    // ENOENT esperado si el archivo temporal nunca llegó a crearse o ya se renombró.
    console.log('[interfaz_remota] Archivo temporal de subida no eliminado (puede no existir):', up.tmpPath, err.message);
  }
}

async function limpiarUploadsVencidos() {
  const ahora = Date.now();
  for (const up of uploads.values()) {
    if (ahora - up.lastActivityAt > UPLOAD_TTL_MS) {
      console.log('[interfaz_remota] Subida vencida y descartada:', up.uploadId);
      await cerrarYDescartar(up);
    }
  }
}
setInterval(() => {
  limpiarUploadsVencidos().catch((err) => console.log('[interfaz_remota] Error al limpiar uploads vencidos:', err.message));
}, 60 * 1000);

// Verificación best-effort de espacio libre: si `statfs` no está disponible en esta
// plataforma/versión de Node, se loguea y se continúa sin bloquear la subida.
async function hayEspacioSuficiente(targetDir, tamanio) {
  if (typeof fsp.statfs !== 'function') return true;
  try {
    const stats = await fsp.statfs(targetDir);
    const libres = stats.bavail * stats.bsize;
    return libres > tamanio;
  } catch (err) {
    console.log('[interfaz_remota] No se pudo verificar espacio libre en disco:', err.message);
    return true;
  }
}

export async function subirAlmacenamientoIniciar({ dir, nombre, size, totalChunks, chunkSize } = {}) {
  if (!nombre || typeof nombre !== 'string') return { success: false, error: 'nombre requerido' };
  if (/[\\/]/.test(nombre) || nombre.includes('..')) return { success: false, error: 'nombre inválido' };
  const tamanio = parseInt(size, 10);
  if (!Number.isFinite(tamanio) || tamanio < 0) return { success: false, error: 'size inválido' };
  if (tamanio > MAX_UPLOAD_BYTES) {
    return { success: false, error: `El archivo supera el máximo permitido (${formatBytes(MAX_UPLOAD_BYTES)})` };
  }
  const tamanioChunk = parseInt(chunkSize, 10);
  if (Number.isFinite(tamanioChunk) && tamanioChunk > MAX_CHUNK_BYTES) {
    return { success: false, error: `La parte supera el máximo permitido (${formatBytes(MAX_CHUNK_BYTES)})` };
  }
  const total = parseInt(totalChunks, 10) || (Number.isFinite(tamanioChunk) && tamanioChunk > 0 ? Math.ceil(tamanio / tamanioChunk) : null);
  if (total !== null && (!Number.isFinite(total) || total < 1)) {
    return { success: false, error: 'totalChunks inválido' };
  }
  const targetDir = resolveConfinedPath(dir || '');
  if (!targetDir) return { success: false, error: 'Ruta fuera del directorio de almacenamiento' };

  if (!(await hayEspacioSuficiente(targetDir, tamanio))) {
    return { success: false, error: `No hay espacio suficiente en disco para recibir ${formatBytes(tamanio)}` };
  }

  const uploadId = genUploadId();
  const tmpPath = path.join(targetDir, `.upload-${uploadId}.part`);
  let fileHandle;
  try {
    await fsp.mkdir(targetDir, { recursive: true });
    fileHandle = await fsp.open(tmpPath, 'w');
  } catch (err) {
    return { success: false, error: 'No se pudo iniciar la subida: ' + err.message };
  }

  uploads.set(uploadId, {
    uploadId,
    targetDir,
    nombre,
    tmpPath,
    fileHandle,
    size: tamanio,
    totalChunks: total,
    chunkSize: Number.isFinite(tamanioChunk) && tamanioChunk > 0 ? tamanioChunk : null,
    received: new Set(),
    pendingWrites: new Map(),
    receivedBytes: 0,
    lastActivityAt: Date.now(),
  });

  return { success: true, data: { uploadId } };
}

export async function subirAlmacenamientoChunk({ uploadId, index, offset, base64, chunk } = {}) {
  const up = uploads.get(uploadId);
  if (!up) return { success: false, error: 'Subida no encontrada o vencida' };

  let buffer;
  if (Buffer.isBuffer(chunk)) {
    buffer = chunk;
  } else if (chunk instanceof ArrayBuffer || ArrayBuffer.isView(chunk)) {
    buffer = Buffer.from(chunk.buffer || chunk, chunk.byteOffset, chunk.byteLength);
  } else if (typeof base64 === 'string') {
    try {
      buffer = Buffer.from(base64, 'base64');
    } catch (err) {
      return { success: false, error: 'base64 inválido: ' + err.message };
    }
  } else {
    return { success: false, error: 'base64 o chunk binario requerido' };
  }

  if (buffer.length > MAX_CHUNK_BYTES) {
    return { success: false, error: `La parte supera el máximo permitido (${formatBytes(MAX_CHUNK_BYTES)})` };
  }

  const idx = parseInt(index, 10);
  if (!Number.isFinite(idx) || idx < 0) {
    return { success: false, error: 'index inválido' };
  }
  if (up.totalChunks && idx >= up.totalChunks) {
    return { success: false, error: `El índice ${idx} está fuera de rango (${up.totalChunks} partes)` };
  }
  let posicion = parseInt(offset, 10);
  if (!Number.isFinite(posicion)) {
    // Compatibilidad con emisores que no mandan offset: se deriva del tamaño de parte
    // declarado en `iniciar` o, en su defecto, del total recibido (envío secuencial legado).
    posicion = up.chunkSize ? idx * up.chunkSize : up.receivedBytes;
  }
  if (!Number.isFinite(posicion) || posicion < 0) {
    return { success: false, error: 'offset inválido' };
  }
  if (up.chunkSize && posicion !== idx * up.chunkSize) {
    return { success: false, error: `offset inconsistente para la parte ${idx}` };
  }
  if (posicion + buffer.length > up.size) {
    return { success: false, error: 'La parte excede el tamaño declarado del archivo' };
  }

  // Idempotencia: el relay de gestión interna puede reintentar la misma parte si su ACK
  // tarda más de lo esperado. Si el índice ya se recibió se responde éxito sin reescribir;
  // si todavía se está escribiendo, se espera esa escritura para no finalizar antes de tiempo.
  if (up.received.has(idx)) {
    const pendiente = up.pendingWrites.get(idx);
    if (pendiente) {
      try {
        await pendiente;
      } catch (err) {
        return { success: false, error: 'Error al escribir el chunk: ' + err.message };
      }
    }
    return { success: true, data: { receivedBytes: up.receivedBytes, index: idx, duplicated: true } };
  }

  up.received.add(idx);
  const escritura = (async () => {
    await up.fileHandle.write(buffer, 0, buffer.length, posicion);
    up.receivedBytes += buffer.length;
  })();
  up.pendingWrites.set(idx, escritura);
  up.lastActivityAt = Date.now();
  try {
    await escritura;
  } catch (err) {
    up.received.delete(idx);
    up.pendingWrites.delete(idx);
    await cerrarYDescartar(up);
    return { success: false, error: 'Error al escribir el chunk: ' + err.message };
  }
  up.pendingWrites.delete(idx);
  return { success: true, data: { receivedBytes: up.receivedBytes, index: idx } };
}

export async function subirAlmacenamientoFinalizar({ uploadId } = {}) {
  const up = uploads.get(uploadId);
  if (!up) return { success: false, error: 'Subida no encontrada o vencida' };
  if (up.pendingWrites.size > 0) {
    await Promise.allSettled(Array.from(up.pendingWrites.values()));
  }
  if (!uploads.has(uploadId)) {
    return { success: false, error: 'La subida se canceló o falló antes de finalizar' };
  }
  if (up.totalChunks && up.received.size !== up.totalChunks) {
    await cerrarYDescartar(up);
    return { success: false, error: `Subida incompleta: se recibieron ${up.received.size} de ${up.totalChunks} partes` };
  }
  if (up.receivedBytes !== up.size) {
    await cerrarYDescartar(up);
    return { success: false, error: `Subida incompleta: se recibieron ${up.receivedBytes} de ${up.size} bytes` };
  }
  const filePath = path.join(up.targetDir, up.nombre);
  try {
    await up.fileHandle.close();
    await fsp.rename(up.tmpPath, filePath);
  } catch (err) {
    uploads.delete(up.uploadId);
    return { success: false, error: 'Error al finalizar la subida: ' + err.message };
  }
  uploads.delete(up.uploadId);
  return { success: true, data: { path: filePath, nombre: up.nombre, size: up.size } };
}

export async function subirAlmacenamientoCancelar({ uploadId } = {}) {
  const up = uploads.get(uploadId);
  if (!up) return { success: true };
  if (up.pendingWrites.size > 0) {
    await Promise.allSettled(Array.from(up.pendingWrites.values()));
  }
  await cerrarYDescartar(up);
  return { success: true };
}
