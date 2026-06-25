import { useCommandRegistry } from '../useCommandRegistry.js'
import { parseCommandArgs } from '../parseCommandArgs.js'

const { register } = useCommandRegistry()

register({
  name: '/redmine_crear_ticket',
  category: 'Utilidades',
  description: 'Abre un formulario inline para crear un nuevo ticket en Redmine: seleccionar proyecto, asunto, descripción, estado, prioridad, asignado y % de avance.',
  usage: '/redmine_crear_ticket [--id=&lt;proyecto_id&gt;]',
  async autocomplete(args, cmdStore) {
    const idArg = args.find(a => a.startsWith('--id='))
    if (idArg) {
      const val = idArg.slice('--id='.length)
      try {
        const res = await fetch('/api/proyecto', { credentials: 'include' })
        const data = await res.json()
        if (data.proyectos) {
          const prefix = val.toLowerCase()
          const filtered = data.proyectos.filter(p => p.id.toLowerCase().includes(prefix))
          if (val && filtered.length === 1 && filtered[0].id === val) {
            cmdStore.hideAutocomplete()
          } else {
            cmdStore.showAutocomplete(filtered.map(p => ({ display: p.id, value: `--id=${p.id}` })))
          }
        }
      } catch (err) {
        console.error('Error en autocomplete de /redmine_crear_ticket:', err)
      }
    } else {
      cmdStore.showAutocomplete(['--id='])
    }
  },
  async execute(args, { chatStore, sessionId }) {
    if (!sessionId) {
      throw new Error('Primero debe iniciar una sesión de chat.')
    }

    let projectId = null
    const { params } = parseCommandArgs(args)

    if (params.id) {
      projectId = params.id
    } else {
      const session = chatStore.sessions.find(s => Number(s.id) === Number(sessionId))
      projectId = session?.proyecto_id || null
    }

    return {
      role: 'opencode_control',
      controlData: {
        controlType: 'ticket_create',
        controlId: 'ticket-create-' + Date.now(),
        sessionId,
        projectId,
      },
    }
  },
})
