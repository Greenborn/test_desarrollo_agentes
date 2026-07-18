import { useCommandRegistry } from '../useCommandRegistry.js'
import { useChatStore } from '../../stores/chat.js'
import { useWorkspaceStore } from '../../stores/workspace.js'
import { useAuthStore } from '../../stores/auth.js'
import { parseCommandArgs, getUsedFlags } from '../parseCommandArgs.js'

const { register } = useCommandRegistry()

register({
  name: '/chat_set_workspace',
  category: 'Desarrollo',
  description: 'Asigna un espacio de trabajo a la sesión actual.',
  usage: '/chat_set_workspace --id=<workspace_id>',
  async autocomplete(args, cmdStore) {
    const usedFlags = getUsedFlags(args)
    if (usedFlags.includes('--id=')) {
      const idArg = args.find(a => a.startsWith('--id='))
      const val = idArg.slice('--id='.length)
      const workspaceStore = useWorkspaceStore()
      const workspaces = workspaceStore.workspaces || []
      const filtered = val
        ? workspaces.filter(w => String(w.id).includes(val) || w.name.toLowerCase().includes(val))
        : workspaces
      if (filtered.length === 0 || (val && filtered.length === 1 && String(filtered[0].id) === val)) {
        cmdStore.hideAutocomplete()
      } else {
        cmdStore.showAutocomplete(
          filtered.map(w => ({
            display: `${w.name} (id: ${w.id})`,
            value: `--id=${w.id}`,
          }))
        )
      }
    } else {
      cmdStore.showAutocomplete(['--id='])
    }
  },
  async execute(args, { chatStore, sessionId }) {
    if (!sessionId) {
      return 'Primero debe iniciar una sesión de chat.'
    }

    const { params, errors } = parseCommandArgs(args, { id: { required: true, type: 'number' } })
    if (errors.length > 0) {
      return errors.join('. ')
    }
    const workspaceId = params.id

    try {
      const res = await fetch(`/api/chat/sessions/${sessionId}/workspace`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ workspaceId }),
      })
      const data = await res.json()
      if (data.success) {
        if (data.workspaceIds) {
          const workspaceStore = useWorkspaceStore()
          const auth = useAuthStore()
          workspaceStore.selectedIds = data.workspaceIds
          auth.setWorkspaceIds(data.workspaceIds)
        }
        await chatStore.loadSessions()
        return `Workspace #${workspaceId} asignado a la sesión actual.`
      }
      return `Error: ${data.error}`
    } catch (err) {
      console.error('Error en /chat_set_workspace:', err)
      return 'Error de conexión al asignar workspace.'
    }
  },
})
