import { useCommandRegistry } from '../useCommandRegistry.js'

const { register } = useCommandRegistry()

register({
  name: '/chat_ticket_edit',
  category: 'Proyecto',
  description: 'Abre un editor inline para modificar los datos del ticket de Redmine asignado a la sesión actual.',
  usage: '/chat_ticket_edit',
  async execute(args, { chatStore }) {
    const sessionId = chatStore.activeSessionId
    if (!sessionId) {
      throw new Error('Primero debe iniciar una sesión de chat.')
    }

    try {
      const res = await fetch(`/api/tickets/session/${sessionId}`, { credentials: 'include' })
      const data = await res.json()

      if (!data.idTicketRedmine || !data.ticket) {
        throw new Error('No hay ticket asignado a esta sesión.')
      }

      return {
        role: 'opencode_control',
        controlData: {
          controlType: 'ticket_edit',
          controlId: 'ticket-edit-' + Date.now(),
          ticket: data.ticket,
          sessionId,
        },
      }
    } catch (err) {
      console.error('Error en /chat_ticket_edit:', err.message)
      throw new Error(err.message || 'Error de conexión al obtener ticket.')
    }
  },
})
