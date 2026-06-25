import { useCommandRegistry } from '../useCommandRegistry.js'
import { parseCommandArgs, getUsedFlags } from '../parseCommandArgs.js'

const { register } = useCommandRegistry()

register({
  name: '/dev_redmine_comentarios_enviar',
  category: 'Desarrollo',
  description: 'Envía los comentarios pendientes a Redmine. Por defecto usa el ticket de la sesión actual. Con --ticket_id se puede especificar otro.',
  usage: '/dev_redmine_comentarios_enviar [--ticket_id=<id>]',
  async autocomplete(args, cmdStore) {
    const usedFlags = getUsedFlags(args)
    if (usedFlags.includes('--ticket_id')) {
      cmdStore.hideAutocomplete()
      return
    }
    if (args.find(a => a.startsWith('--ticket_id='))) {
      cmdStore.hideAutocomplete()
      return
    }
    try {
      const { useChatStore } = await import('../../stores/chat.js')
      const chatStore = useChatStore()
      const sessionId = chatStore.activeSessionId
      if (!sessionId) {
        cmdStore.showAutocomplete(['--ticket_id='])
        return
      }
      const sessionRes = await fetch(`/api/tickets/session/${sessionId}`, { credentials: 'include' })
      const sessionData = await sessionRes.json()
      if (!sessionData.ticket?.proyecto_id) {
        cmdStore.showAutocomplete(['--ticket_id='])
        return
      }
      const ticketRes = await fetch('/api/tickets?proyecto_id=' + encodeURIComponent(sessionData.ticket.proyecto_id), { credentials: 'include' })
      const ticketData = await ticketRes.json()
      if (ticketData.tickets) {
        const prefix = (args.find(a => a.startsWith('--ticket_id=')) || '').split('=')[1] || ''
        const filtered = ticketData.tickets.filter(t => String(t.redmine_id).includes(prefix))
        cmdStore.showAutocomplete(filtered.map(t => ({ display: `#${t.redmine_id} — ${t.subject}`, value: `--ticket_id=${t.redmine_id}` })))
      }
    } catch (err) {
      console.error('Error en autocomplete de redmineComentariosEnviar:', err.message)
      cmdStore.showAutocomplete(['--ticket_id='])
    }
  },
  async execute(args, { chatStore, sessionId }) {
    if (!sessionId) {
      throw new Error('Primero debe iniciar una sesión de chat.')
    }

    const { params } = parseCommandArgs(args, { ticket_id: { required: false } })
    let ticketId = params.ticket_id

    if (!ticketId) {
      try {
        const sessionRes = await fetch(`/api/tickets/session/${sessionId}`, { credentials: 'include' })
        const sessionData = await sessionRes.json()
        ticketId = sessionData.idTicketRedmine
        if (!ticketId) {
          return 'No hay ticket asignado a esta sesión. Especificá --ticket_id=<id> o asigná un ticket con /chat_set_ticket.'
        }
      } catch (err) {
        console.error('Error al obtener ticket de sesión:', err.message)
        throw new Error('Error al obtener ticket de la sesión.')
      }
    }

    try {
      const url = `/api/redmine/comments?estado=pendiente&ticket_redmine_id=${ticketId}&sessionId=${sessionId}`
      const res = await fetch(url, { credentials: 'include' })
      const data = await res.json()

      if (!data.success) {
        throw new Error(data.error || 'Error al obtener comentarios')
      }

      const comentarios = data.comentarios || []

      if (comentarios.length === 0) {
        return `No hay comentarios pendientes para el ticket #${ticketId}.`
      }

      const ticketTag = `[#${ticketId}]`
      function formatComment(comentario) {
        const trimmed = comentario.trim()
        const match = trimmed.match(/^([\s\S]*?)\n{2,}(https?:\/\/\S+)$/)
        if (match) {
          return `- ${ticketTag} ${match[1].trim()}: ${match[2]}`
        }
        if (trimmed.startsWith('- ')) {
          return `- ${ticketTag} ${trimmed.slice(2)}`
        }
        return `- ${ticketTag} ${trimmed}`
      }

      const combined = comentarios.map((c) => formatComment(c.comentario)).join('\n')

      chatStore.pushMessage({
        role: 'opencode_control',
        controlData: {
          controlId: 'rm-comments-send-' + Date.now(),
          controlType: 'redmine_comments_send',
          comentarios_ids: comentarios.map(c => c.id),
          ticket_redmine_id: parseInt(ticketId, 10),
          mensaje: combined,
          cantidad: comentarios.length,
        },
        _key: 'control-' + Date.now(),
      }, sessionId)
    } catch (err) {
      console.error('Error en /dev_redmine_comentarios_enviar:', err.message)
      throw new Error('Error al preparar envío de comentarios: ' + err.message)
    }
  },
})
