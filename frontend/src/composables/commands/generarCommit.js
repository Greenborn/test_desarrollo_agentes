import { useCommandRegistry } from '../useCommandRegistry.js'
import { useChatStore } from '../../stores/chat.js'
import { useOpencodeStreaming } from '../useOpencodeStreaming.js'

const { register } = useCommandRegistry()

register({
  name: '/dev_generar_commit',
  category: 'Desarrollo',
  description: 'Genera un mensaje de commit de los cambios realizados. Obtiene el diff de Git y contexto del ticket, y usa DeepSeek para generar una propuesta.',
  usage: '/dev_generar_commit',
  async execute(args, { cmdStore, chatStore, sessionId }) {
    if (!sessionId) {
      console.error('Error en /dev_generar_commit: no hay sesión de chat activa')
      return
    }

    const chat = useChatStore()

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

    let ticketContext = ''
    try {
      const session = chat.sessions.find(s => Number(s.id) === Number(sessionId))
      const ticketRedmineId = session?.id_ticket_redmine || null
      if (ticketRedmineId) {
        const ticketRes = await fetch(`/api/tickets/session/${sessionId}?comments=true`, { credentials: 'include' })
        const ticketData = await ticketRes.json()
        if (ticketData.ticket) {
          ticketContext += `## Contexto del ticket #${ticketRedmineId}\n\n`
          ticketContext += `- **Título:** ${ticketData.ticket.subject || ''}\n`
          ticketContext += `- **Estado:** ${ticketData.ticket.status_name || ''}\n`
          ticketContext += `- **Prioridad:** ${ticketData.ticket.priority_name || ''}\n`
          ticketContext += `- **Asignado a:** ${ticketData.ticket.assigned_to_name || ''}\n`
          if (ticketData.ticket.description) {
            ticketContext += `- **Descripción:** ${ticketData.ticket.description}\n`
          }
        }
        if (ticketData.comments && ticketData.comments.length > 0) {
          ticketContext += `\n### Comentarios existentes en Redmine (${ticketData.comments.length})\n\n`
          for (const c of ticketData.comments) {
            ticketContext += `- **${c.user}** (${c.created_on}): ${c.notes}\n`
          }
        }
      }
    } catch (err) {
      console.error('Error al obtener contexto del ticket:', err.message)
    }

    const DIFF_LIMIT = 15000
    const truncatedDiff = gitDiff.length > DIFF_LIMIT
      ? gitDiff.slice(0, DIFF_LIMIT) + '\n... (diff truncado por longitud)'
      : gitDiff

    const prompt = (ticketContext ? ticketContext + '\n---\n\n' : '') +
      `## Git diff de los cambios realizados\n\n\`\`\`diff\n${truncatedDiff}\n\`\`\``

    const systemPrompt = ticketContext
      ? 'Eres un asistente experto en generar mensajes de commit. Regla 75/25: el 75% del mensaje debe describir los cambios PUNTUALES del diff (archivos, funciones, lógica modificada). Solo el 25% restante puede usar el contexto del ticket para redondear el propósito general. Priorizá siempre los cambios concretos del diff sobre la descripción del ticket. Máximo 512 caracteres. Devolvé ÚNICAMENTE el mensaje de commit.'
      : 'Eres un asistente experto en generar mensajes de commit. Basate en los cambios del git diff para describir los cambios PUNTUALES (archivos, funciones, lógica modificada) y el IMPACTO de esos cambios en el proyecto. Máximo 512 caracteres. Devolvé ÚNICAMENTE el mensaje de commit.'

    const { deepseekStreamCommit } = useOpencodeStreaming()
    await deepseekStreamCommit(sessionId, prompt, systemPrompt)
  },
})
