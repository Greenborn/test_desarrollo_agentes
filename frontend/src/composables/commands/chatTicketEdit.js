import { useCommandRegistry } from '../useCommandRegistry.js'
import { useOpencodeStore } from '../../stores/opencode.js'

const { register } = useCommandRegistry()

register({
  name: '/chat_ticket_edit',
  category: 'Proyecto',
  description: 'Abre un editor inline para modificar los datos del ticket de Redmine asignado a la sesión actual. Con el argumento "descripcion" abre un asistente con OpenCode para redactar una descripción.',
  usage: '/chat_ticket_edit [descripcion]',
  async autocomplete(args, cmdStore) {
    const current = args[0] || ''
    const filtered = ['descripcion'].filter((t) => t.startsWith(current))
    cmdStore.showAutocomplete(filtered)
  },
  async execute(args, { chatStore }) {
    const sessionId = chatStore.activeSessionId
    if (!sessionId) {
      throw new Error('Primero debe iniciar una sesión de chat.')
    }

    const res = await fetch(`/api/tickets/session/${sessionId}`, { credentials: 'include' })
    const data = await res.json()

    if (!data.idTicketRedmine || !data.ticket) {
      throw new Error('No hay ticket asignado a esta sesión.')
    }

    if (args[0] === 'descripcion') {
      const ocStore = useOpencodeStore()
      const startData = await ocStore.start()
      if (!startData) {
        throw new Error('Error al iniciar OpenCode.')
      }

      const providerList = ocStore.getAvailableProviders()
      if (providerList.length === 0) {
        throw new Error('No se encontraron proveedores de OpenCode.')
      }

      const preselectProvider = ocStore.savedProvider || providerList[0].value

      return {
        role: 'opencode_control',
        controlData: {
          controlId: 'provider-' + Date.now(),
          controlType: 'select',
          stepType: 'ticket_descripcion',
          subStepType: 'provider',
          options: providerList,
          placeholder: 'Selecciona proveedor...',
          preselect: preselectProvider,
          ticket: data.ticket,
          sessionId,
        },
      }
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
  },
})
