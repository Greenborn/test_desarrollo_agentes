import { useCommandRegistry } from '../useCommandRegistry.js'
import { useOpencodeStore } from '../../stores/opencode.js'
import { parseCommandArgs } from '../parseCommandArgs.js'

const { register } = useCommandRegistry()

register({
  name: '/chat_edit_ticket',
  category: 'Proyecto',
  description: 'Abre un editor inline para modificar los datos del ticket de Redmine asignado a la sesión actual. Con --mode=descripcion abre un asistente con OpenCode para redactar una descripción.',
  usage: '/chat_edit_ticket [--mode=descripcion]',
  async autocomplete(args, cmdStore) {
    const modeArg = args.find(a => a.startsWith('--mode='))
    if (modeArg) {
      const val = modeArg.slice('--mode='.length)
      if (val === 'descripcion') {
        cmdStore.hideAutocomplete()
      } else {
        const filtered = ['descripcion'].filter(t => t.startsWith(val))
        cmdStore.showAutocomplete(filtered.map(v => ({ display: v, value: `--mode=${v}` })))
      }
    } else {
      cmdStore.showAutocomplete(['--mode='])
    }
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

    const { params } = parseCommandArgs(args, { mode: { required: false } })

    if (params.mode === 'descripcion') {
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
