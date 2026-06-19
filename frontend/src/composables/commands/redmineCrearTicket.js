import { useCommandRegistry } from '../useCommandRegistry.js'

const { register } = useCommandRegistry()

register({
  name: '/redmine_crear_ticket',
  category: 'Utilidades',
  description: 'Abre un formulario inline para crear un nuevo ticket en Redmine: seleccionar proyecto, asunto, descripción, estado, prioridad, asignado y % de avance.',
  usage: '/redmine_crear_ticket',
  async execute(args, { chatStore }) {
    const sessionId = chatStore.activeSessionId
    if (!sessionId) {
      throw new Error('Primero debe iniciar una sesión de chat.')
    }

    return {
      role: 'opencode_control',
      controlData: {
        controlType: 'ticket_create',
        controlId: 'ticket-create-' + Date.now(),
        sessionId,
      },
    }
  },
})
