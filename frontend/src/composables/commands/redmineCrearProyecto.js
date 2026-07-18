import { useCommandRegistry } from '../useCommandRegistry.js'
import { parseCommandArgs } from '../parseCommandArgs.js'

const { register } = useCommandRegistry()

register({
  name: '/redmine_crear_proyecto',
  category: 'Utilidades',
  description: 'Crea un nuevo proyecto en la base de datos local y en Redmine.',
  usage: '/redmine_crear_proyecto [--nombre=<nombre>] [--descripcion=<texto>] [--workspace=<id>]',

  async autocomplete(args, cmdStore) {
    const hasWorkspace = args.some(a => a.startsWith('--workspace'))
    if (!hasWorkspace) {
      try {
        const res = await fetch('/api/workspaces', { credentials: 'include' })
        const data = await res.json()
        if (data.workspaces) {
          cmdStore.showAutocomplete(data.workspaces.map(w => `--workspace=${w.id}`))
          return
        }
      } catch (err) {
        console.error('Error al cargar workspaces:', err)
      }
    }
    cmdStore.hideAutocomplete()
  },

  async execute(args, { chatStore, sessionId }) {
    if (!sessionId) {
      throw new Error('Primero debe iniciar una sesión de chat.')
    }

    const { params } = parseCommandArgs(args, {
      nombre: { required: false },
      descripcion: { required: false },
      workspace: { required: false },
    })

    return {
      role: 'opencode_control',
      controlData: {
        controlType: 'redmine_crear_proyecto',
        controlId: 'crear-proyecto-' + Date.now(),
        sessionId,
        prefill: {
          nombre: params.nombre || '',
          descripcion: params.descripcion || '',
          workspaceId: params.workspace ? parseInt(params.workspace) : null,
        },
      },
    }
  },
})
