import { reactive } from 'vue'
import { useCommandRegistry } from '../useCommandRegistry.js'

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

register({
  name: '/deteccion_funcionalidades',
  category: 'Detección',
  description: 'Obtiene el listado de archivos de código del proyecto, los resume uno por uno vía DeepSeek y entrega el JSON completo con descripciones.',
  usage: '/deteccion_funcionalidades',
  async execute(args, { chatStore }) {
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

      let escaneoId = null
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

      deteccionState.running = true
      deteccionState.total = files.length
      deteccionState.processed = 0

      for (let i = 0; i < files.length; i++) {
        if (_deteccionAbort) break

        const file = files[i]
        deteccionState.processed = i
        deteccionState.current = file.path

        try {
          const fileRes = await fetch(`/api/command/read-file?path=${encodeURIComponent(file.path)}`, { credentials: 'include' })
          const fileData = await fileRes.json()

          if (fileData.success && fileData.content) {
            const summaryRes = await fetch('/api/chat/summarize-file', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              credentials: 'include',
              body: JSON.stringify({ filePath: file.path, fileContent: fileData.content, sessionId }),
            })
            const summaryData = await summaryRes.json()

            file.description = summaryData.description || '(sin descripción)'

            chatStore.pushMessage({
              role: 'result',
              content: `✅ ${file.path} — ${file.description}`,
              _key: 'desc-' + Date.now(),
            })
          } else {
            file.description = '(error al leer)'
            chatStore.pushMessage({
              role: 'result',
              content: `⚠️ ${file.path} — error al leer el archivo`,
              _key: 'err-' + Date.now(),
            })
          }
        } catch (err) {
          console.error('Error procesando archivo:', file.path, err)
          file.description = err.message || 'error'
          chatStore.pushMessage({
            role: 'result',
            content: `⚠️ ${file.path} — ${err.message || 'error'}`,
            _key: 'err-' + Date.now(),
          })
        }

        if (escaneoId && file.description) {
          try {
            const ext = file.name.includes('.') ? file.name.split('.').pop() : null
            await fetch('/api/documentacion/archivo', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              credentials: 'include',
              body: JSON.stringify({
                escaneo_id: escaneoId,
                nombre: file.name,
                ruta: file.path,
                tipo: file.type || 'file',
                extension: ext,
                tamano: file.size || null,
                descripcion: file.description || null,
              }),
            })
          } catch (err) {
            console.error('Error al guardar archivo en DB:', file.path, err)
          }
        }
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
