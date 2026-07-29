const OLLAMA_HOST = process.env.OLLAMA_HOST || 'http://localhost:11434'

function baseUrl() {
  return OLLAMA_HOST
}

async function isRunning() {
  try {
    const res = await fetch(`${baseUrl()}/api/tags`, { signal: AbortSignal.timeout(3000) })
    return res.ok
  } catch (err) {
    console.log('[ollamaService] Error en health check:', err.message)
    return false
  }
}

async function ensureRunning() {
  if (await isRunning()) return
  throw new Error('Ollama no está corriendo. Asegúrate de que el servicio Ollama esté activo en ' + OLLAMA_HOST)
}

export default {
  baseUrl,
  isRunning,
  ensureRunning,
}
