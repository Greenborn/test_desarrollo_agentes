import { useCommandRegistry } from '../useCommandRegistry.js'
import { parseCommandArgs, getUsedFlags } from '../parseCommandArgs.js'

const { register } = useCommandRegistry()

register({
  name: '/dev_redmine_comentarios_listar',
  category: 'Desarrollo',
  description: 'Lista los comentarios de Redmine pendientes de envío. Por defecto usa el ticket de la sesión actual. Con --ticket_id se puede especificar otro.',
  usage: '/dev_redmine_comentarios_listar [--ticket_id=<id>]',
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
      console.error('Error en autocomplete de redmineComentariosListar:', err.message)
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
      const url = `/api/redmine/comments?estado=pendiente&ticket_redmine_id=${ticketId}`
      const res = await fetch(url, { credentials: 'include' })
      const data = await res.json()

      if (!data.success) {
        throw new Error(data.error || 'Error al obtener comentarios')
      }

      const comentarios = data.comentarios || []

      if (comentarios.length === 0) {
        return `No hay comentarios pendientes para el ticket #${ticketId}.`
      }

      let output = `**Comentarios pendientes del ticket #${ticketId} (${comentarios.length}):**\n\n`
      output += '| # | Comentario | Creado |\n'
      output += '|---|---|---|\n'

      comentarios.forEach((c) => {
        const preview = c.comentario.length > 80
          ? c.comentario.slice(0, 80) + '...'
          : c.comentario
        const fecha = c.created_at
          ? new Date(c.created_at).toLocaleString()
          : '—'
        output += `| ${c.id} | ${preview.replace(/\n/g, ' ')} | ${fecha} |\n`
      })

      return output
    } catch (err) {
      console.error('Error en /dev_redmine_comentarios_listar:', err.message)
      throw new Error('Error al listar comentarios: ' + err.message)
    }
  },
})
