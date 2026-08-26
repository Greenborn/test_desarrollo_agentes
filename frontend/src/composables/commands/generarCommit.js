import { useCommandRegistry } from '../useCommandRegistry.js'
import { useChatStore } from '../../stores/chat.js'
import { useOpencodeStreaming } from '../useOpencodeStreaming.js'

const { register } = useCommandRegistry()

const runningBySession = {}

register({
  name: '/dev_generar_commit',
  category: 'Desarrollo',
  description: 'Genera un mensaje de commit de los cambios realizados. Obtiene el diff de Git y usa DeepSeek para generar una propuesta basada en los cambios.',
  usage: '/dev_generar_commit',
  async execute(args, { cmdStore, chatStore, sessionId }) {
    if (!sessionId) {
      console.error('Error en /dev_generar_commit: no hay sesión de chat activa')
      return
    }

    const chat = useChatStore()
    const sessionKey = String(sessionId)

    if (runningBySession[sessionKey]) {
      chat.pushMessage({
        role: 'result',
        content: '⚠️ Ya hay un proceso de /dev_generar_commit en curso en esta sesión. Esperá a que finalice antes de ejecutarlo de nuevo.',
        _key: 'duplicate-' + Date.now(),
      }, sessionId)
      return
    }
    runningBySession[sessionKey] = true

    try {
      await _runCommit(sessionId, chat)
    } finally {
      delete runningBySession[sessionKey]
    }
  },
})

async function _runCommit(sessionId, chat) {
    chat.pushMessage({
      role: 'result',
      content: '🔄 Obteniendo cambios de Git...',
      _key: 'loading-' + Date.now(),
    }, sessionId)

    let gitDiff = ''
    try {
      const res = await fetch('/api/command/git', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ command: 'diff HEAD', sessionId }),
      })
      const data = await res.json()
      if (data.success && data.stdout) gitDiff = data.stdout

      if (!gitDiff) {
        const res2 = await fetch('/api/command/git', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          credentials: 'include',
          body: JSON.stringify({ command: 'diff --cached', sessionId }),
        })
        const data2 = await res2.json()
        if (data2.success && data2.stdout) gitDiff = data2.stdout
      }

      if (!gitDiff) {
        const res3 = await fetch('/api/command/git', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          credentials: 'include',
          body: JSON.stringify({ command: 'status --porcelain', sessionId }),
        })
        const data3 = await res3.json()
        if (data3.success && data3.stdout) {
          gitDiff = '--- Working tree status ---\n' + data3.stdout
        }
      }
    } catch (err) {
      console.error('Error al obtener diff de git:', err.message)
    }

    if (!gitDiff) {
      chat.pushMessage({
        role: 'result',
        content: 'No se encontraron cambios en el repositorio. No hay nada para commitear.',
        _key: 'result-' + Date.now(),
      }, sessionId)
      return
    }

    const DIFF_LIMIT = 15000
    const truncatedDiff = gitDiff.length > DIFF_LIMIT
      ? gitDiff.slice(0, DIFF_LIMIT) + '\n... (diff truncado por longitud)'
      : gitDiff

    const prompt = `## Git diff de los cambios realizados\n\n\`\`\`diff\n${truncatedDiff}\n\`\`\``

    const systemPrompt = 'Eres un asistente experto en generar mensajes de commit. Basate en los cambios del git diff para describir los cambios PUNTUALES (archivos, funciones, lógica modificada) y el IMPACTO de esos cambios en el proyecto. Máximo 512 caracteres. Devolvé ÚNICAMENTE el mensaje de commit.'

    const { deepseekStreamCommit } = useOpencodeStreaming()
    await deepseekStreamCommit(sessionId, prompt, systemPrompt)
  }

