import { reactive } from 'vue'
import { useCommandRegistry } from '../useCommandRegistry.js'
import { useOpencodeStore } from '../../stores/opencode.js'

const { register } = useCommandRegistry()

let _deteccionAbort = false

export const deteccionState = reactive({
  running: false,
  current: '',
  total: 0,
  processed: 0,
})

export function getDeteccionSessionId() {
  return _deteccionSessionId
}

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

let _deteccionTree = null
let _deteccionFiles = []
let _deteccionSessionId = null
let _deteccionChatStore = null

export async function startDeteccionProcessing(sessionId, chatStore, model, thinking) {
  _deteccionAbort = false

  const tree = _deteccionTree
  const files = _deteccionFiles

  deteccionState.running = true
  deteccionState.total = files.length
  deteccionState.processed = 0

  for (let i = 0; i < files.length && !_deteccionAbort; i += 10) {
    const chunk = files.slice(i, i + 10)

    deteccionState.processed = i
    deteccionState.current = chunk.length > 1 ? `${chunk[0].path} (+${chunk.length - 1})` : chunk[0].path

    const reads = await Promise.all(chunk.map(async (file) => {
      try {
        const fileRes = await fetch(`/api/command/read-file?path=${encodeURIComponent(file.path)}`, { credentials: 'include' })
        const fileData = await fileRes.json()
        return { file, content: fileData.success ? (fileData.content || '') : null, error: !fileData.success }
      } catch (err) {
        return { file, content: null, error: err.message || 'error' }
      }
    }))

    const validFiles = reads.filter(r => r.content !== null)
    const descriptions = {}

    if (validFiles.length > 0) {
      try {
        const batchRes = await fetch('/api/chat/summarize-files-batch', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          credentials: 'include',
          body: JSON.stringify({
            files: validFiles.map(r => ({ path: r.file.path, content: r.content })),
            model,
            thinking,
            sessionId,
          }),
        })
        const batchData = await batchRes.json()
        if (batchData.descriptions) {
          for (const [path, desc] of Object.entries(batchData.descriptions)) {
            descriptions[path] = desc
          }
        }
      } catch (err) {
        console.error('Error en batch DeepSeek:', err)
      }
    }

    for (const r of reads) {
      const desc = r.content ? (descriptions[r.file.path] || '(sin descripción)') : '(error al leer)'
      r.file.description = desc
      const prefix = r.content ? '✅' : '⚠️'
      chatStore.pushMessage({
        role: 'result',
        content: `${prefix} ${r.file.path} — ${desc}`,
        _key: 'desc-' + Date.now(),
      }, sessionId)
    }
  }

  if (_deteccionAbort) {
    chatStore.pushMessage({
      role: 'result',
      content: '⏹ Proceso detenido por el usuario.',
      _key: 'abort-' + Date.now(),
    }, sessionId)
  }

  deteccionState.running = false
  deteccionState.current = ''

  chatStore.pushMessage({
    role: 'result',
    content: JSON.stringify(tree, null, 2),
    _key: 'json-' + Date.now(),
  }, sessionId)
}

register({
  name: '/deteccion_funcionalidades',
  category: 'Detección',
  description: 'Analiza archivos de código del proyecto y genera descripciones vía DeepSeek. Permite elegir modelo y nivel de pensamiento.',
  usage: '/deteccion_funcionalidades',
  async execute(args, { chatStore, sessionId }) {
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

      _deteccionTree = data.tree
      _deteccionFiles = flattenFiles(data.tree)
      _deteccionSessionId = sessionId
      _deteccionChatStore = chatStore

      chatStore.pushMessage({
        role: 'result',
        content: `📊 Total archivos de código: ${_deteccionFiles.length}`,
        _key: 'count-' + Date.now(),
      }, sessionId)

      const ocStore = useOpencodeStore()

      const modelOptions = [
        { label: '🟢 DeepSeek Flash (deepseek-v4-flash) — más rápido y económico', value: 'deepseek-v4-flash' },
        { label: '🔴 DeepSeek Reasoner (deepseek-reasoner) — razonamiento profundo', value: 'deepseek-reasoner' },
      ]

      chatStore.pushMessage({
        role: 'opencode_control',
        controlData: {
          controlId: 'df-model-' + Date.now(),
          controlType: 'select',
          stepType: 'deteccion_model_setup',
          subStepType: 'model',
          options: modelOptions,
          placeholder: 'Selecciona modelo DeepSeek...',
          preselect: ocStore.savedModel || 'deepseek-v4-flash',
        },
        _key: 'ctrl-model-' + Date.now(),
      }, sessionId)
    } catch (err) {
      resetState()
      console.error('Error en /deteccion_funcionalidades:', err)
      throw err
    }
  },
})
