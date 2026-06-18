import { useCommandRegistry } from '../useCommandRegistry.js'
import { useChatStore } from '../../stores/chat.js'

const { register } = useCommandRegistry()

register({
  name: '/chat_set_ticket',
  category: 'Proyecto',
  description: 'Asigna un ticket de Redmine a la sesión actual. El autocomplete se filtra por el proyecto asignado a la sesión.',
  usage: '/chat_set_ticket <id_ticket_redmine>',
  async autocomplete(args, cmdStore) {
    try {
      const chatStore = useChatStore()
      const activeSessionId = chatStore.activeSessionId
      let proyectoId = null

      if (activeSessionId) {
        const session = chatStore.sessions.find(s => s.id === activeSessionId)
        proyectoId = session?.proyecto_id || null
      }

      const res = await fetch('/api/tickets', { credentials: 'include' })
      const data = await res.json()

      if (!data.success || !data.tickets) {
        cmdStore.showAutocomplete([])
        return
      }

      let tickets = data.tickets
      if (proyectoId) {
        tickets = tickets.filter(t => t.proyecto_id === proyectoId)
      }

      cmdStore.showAutocomplete(
        tickets.map(t => ({
          display: `#${t.redmine_id} — ${t.subject}`,
          value: String(t.redmine_id),
        }))
      )
    } catch (err) {
      console.error('Error en autocomplete de /chat_set_ticket:', err)
    }
  },
  async execute(args, { chatStore }) {
    const sessionId = chatStore.activeSessionId
    if (!sessionId) {
      throw new Error('Primero debe iniciar una sesión de chat.')
    }

    const idTicketRedmine = args[0]
    if (!idTicketRedmine) {
      throw new Error('Debe especificar el ID del ticket de Redmine. Use Tab para ver las opciones disponibles.')
    }

    try {
      const res = await fetch('/api/tickets/session', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ sessionId, idTicketRedmine: parseInt(idTicketRedmine) }),
      })
      const data = await res.json()
      if (data.success) {
        await chatStore.loadSessions()
        return `Ticket #${idTicketRedmine} asignado a la sesión actual.`
      }
      throw new Error(data.error || 'Error al asignar ticket')
    } catch (err) {
      console.error('Error en /chat_set_ticket:', err.message)
      throw new Error('Error de conexión al asignar ticket.')
    }
  },
})
