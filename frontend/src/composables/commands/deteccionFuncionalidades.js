import { reactive } from 'vue'
import { useCommandRegistry } from '../useCommandRegistry.js'
import { parseCommandArgs } from '../parseCommandArgs.js'

const { register } = useCommandRegistry()

let _deteccionAbort = false

export const deteccionState = reactive({
  running: false,
  current: '',
  total: 0,
  processed: 0,
})

export function abortDeteccion() {
  _deteccionAbort = true
}

function resetState() {
  _deteccionAbort = false
  deteccionState.running = false
  deteccionState.current = ''
  deteccionState.total = 0
  deteccionState.processed = 0
}

function flattenFiles(node) {
  const files = []
  if (node.type === 'file') {
    files.push(node)
  }
  if (node.type === 'directory' && node.children) {
    for (const child of node.children) {
      files.push(...flattenFiles(child))
    }
  }
  return files
}

let batch = []

async function flushBatch() {
  if (batch.length === 0) return
  const items = batch.splice(0)
  try {
    await fetch('/api/documentacion/archivo/batch', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      credentials: 'include',
      body: JSON.stringify({ items }),
    })
  } catch (err) {
    console.error('Error al guardar batch de archivos:', err)
  }
}

register({
  name: '/deteccion_funcionalidades',
  category: 'Detección',
  description: 'Obtiene el listado de archivos de código del proyecto, los resume uno por uno vía DeepSeek y entrega el JSON completo con descripciones. Si se especifica --escaneo-id, reutiliza un escaneo existente sobrescribiendo sus datos.',
  usage: '/deteccion_funcionalidades [--escaneo-id=&lt;id&gt;]',
  async execute(args, { chatStore }) {
    const { params } = parseCommandArgs(args, {
      'escaneo-id': { required: false },
    })

    const sessionId = chatStore.activeSessionId
    if (!sessionId) {
      throw new Error('Primero debe iniciar una sesión de chat.')
    }

    resetState()

    try {
      const settingsRes = await fetch('/api/settings', { credentials: 'include' })
      const settingsKeys = await settingsRes.json()
      const extensions = settingsKeys.code_file_extensions || '.js,.jsx,.ts,.tsx,.vue,.py,.php,.java,.rb,.go,.rs,.c,.cpp,.h,.hpp,.cs,.swift,.kt,.scala,.sh,.bash,.pl,.lua,.r,.m,.mm,.css,.scss,.less,.sass,.html,.sql'
      const maxSizeKb = parseInt(settingsKeys.code_file_max_size_kb, 10) || 100

      const qparams = new URLSearchParams()
      qparams.set('sessionId', sessionId)
      qparams.set('useGitignore', 'true')
      qparams.set('codeExtensions', extensions)
      qparams.set('maxSizeKb', String(maxSizeKb))
      const res = await fetch(`/api/command/arbol-directorios?${qparams.toString()}`, { credentials: 'include' })
      const data = await res.json()

      if (!data.success) {
        throw new Error(data.error || 'Error al obtener árbol de directorios')
      }

      const tree = data.tree
      const files = flattenFiles(tree)

      chatStore.pushMessage({
        role: 'result',
        content: `📊 Total archivos de código: ${files.length}`,
        _key: 'count-' + Date.now(),
      })

      let escaneoId = params['escaneo-id'] ? parseInt(params['escaneo-id'], 10) : null
      if (!escaneoId) {
        try {
          const ultimoRes = await fetch('/api/documentacion/escaneo/ultimo/' + sessionId, { credentials: 'include' })
          const ultimoData = await ultimoRes.json()
          escaneoId = ultimoData.id
        } catch (err) {
          console.error('Error al obtener último escaneo:', err)
        }
      }
      if (escaneoId) {
        try {
          await fetch('/api/documentacion/archivo/por-escaneo/' + escaneoId, { method: 'DELETE', credentials: 'include' })
        } catch (err) {
          console.error('Error al limpiar archivos previos del escaneo:', err)
        }
      } else {
        try {
          const escRes = await fetch('/api/documentacion/escaneo/iniciar', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            credentials: 'include',
            body: JSON.stringify({ session_id: sessionId }),
          })
          const escData = await escRes.json()
          escaneoId = escData.id
        } catch (err) {
          console.error('Error al iniciar escaneo en DB:', err)
        }
      }

      deteccionState.running = true
      deteccionState.total = files.length
      deteccionState.processed = 0

      for (let i = 0; i < files.length && !_deteccionAbort; i += 10) {
        const chunk = files.slice(i, i + 10)

        deteccionState.processed = i
        deteccionState.current = chunk.length > 1 ? `${chunk[0].path} (+${chunk.length - 1})` : chunk[0].path

        const results = await Promise.all(chunk.map(async (file) => {
          try {
            const fileRes = await fetch(`/api/command/read-file?path=${encodeURIComponent(file.path)}`, { credentials: 'include' })
            const fileData = await fileRes.json()

            let description
            if (fileData.success && fileData.content) {
              const summaryRes = await fetch('/api/chat/summarize-file', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                credentials: 'include',
                body: JSON.stringify({ filePath: file.path, fileContent: fileData.content, sessionId }),
              })
              const summaryData = await summaryRes.json()
              description = summaryData.description || '(sin descripción)'
            } else {
              description = '(error al leer)'
            }

            file.description = description
            return { file, description, error: null }
          } catch (err) {
            console.error('Error procesando archivo:', file.path, err)
            file.description = err.message || 'error'
            return { file, description: err.message || 'error', error: err }
          }
        }))

        for (const { file, description, error } of results) {
          const prefix = error ? '⚠️' : '✅'
          chatStore.pushMessage({
            role: 'result',
            content: `${prefix} ${file.path} — ${description}`,
            _key: 'desc-' + Date.now(),
          })
        }

        if (escaneoId) {
          for (const { file, description } of results) {
            const ext = file.name.includes('.') ? file.name.split('.').pop() : null
            batch.push({
              escaneo_id: escaneoId,
              nombre: file.name,
              ruta: file.path,
              tipo: file.type || 'file',
              extension: ext,
              tamano: file.size || null,
              descripcion: description || null,
            })
          }
          await flushBatch()
        }
      }

      if (escaneoId && batch.length > 0) {
        await flushBatch()
      }

      if (escaneoId) {
        try {
          await fetch(`/api/documentacion/escaneo/${escaneoId}/finalizar`, {
            method: 'PUT',
            headers: { 'Content-Type': 'application/json' },
            credentials: 'include',
            body: JSON.stringify({
              total_archivos: files.length,
              archivos_procesados: deteccionState.processed + (_deteccionAbort ? 0 : 1),
            }),
          })
        } catch (err) {
          console.error('Error al finalizar escaneo en DB:', err)
        }
      }

      if (_deteccionAbort) {
        chatStore.pushMessage({
          role: 'result',
          content: '⏹ Proceso detenido por el usuario.',
          _key: 'abort-' + Date.now(),
        })
      }

      deteccionState.running = false
      deteccionState.current = ''

      chatStore.pushMessage({
        role: 'result',
        content: JSON.stringify(tree, null, 2),
        _key: 'json-' + Date.now(),
      })
    } catch (err) {
      resetState()
      console.error('Error en /deteccion_funcionalidades:', err)
      throw err
    }
  },
})
