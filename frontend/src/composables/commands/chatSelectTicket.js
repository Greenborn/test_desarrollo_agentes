import { useCommandRegistry } from '../useCommandRegistry.js'
import { useChatStore } from '../../stores/chat.js'

const { register } = useCommandRegistry()

register({
  name: '/chat_select_ticket',
  category: 'Proyecto',
  description: 'Abre un selector interactivo para buscar y asignar un ticket de Redmine a la sesión actual. Permite buscar por ID o asunto, o ingresar directamente un número de ticket.',
  usage: '/chat_select_ticket',
  async execute(args, { chatStore, sessionId }) {
    if (!sessionId) {
      throw new Error('Primero debe iniciar una sesión de chat.')
    }

    const session = chatStore.sessions.find(s => Number(s.id) === Number(sessionId))
    let ticketInfo = null
    if (session?.id_ticket_redmine) {
      try {
        const res = await fetch(`/api/tickets/session/${sessionId}`, { credentials: 'include' })
        const data = await res.json()
        if (data.ticket) {
          ticketInfo = data.ticket
        }
      } catch (err) {
        console.error('Error al cargar ticket actual:', err)
      }
    }

    return {
      role: 'opencode_control',
      controlData: {
        controlType: 'ticket_selector',
        controlId: 'ticket-select-' + Date.now(),
        sessionId,
        ticketInfo,
      },
    }
  },
})
