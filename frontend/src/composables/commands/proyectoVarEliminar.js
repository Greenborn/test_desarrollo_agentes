import { useCommandRegistry } from '../useCommandRegistry.js';
import { parseCommandArgs, getUsedFlags } from '../parseCommandArgs.js';
import { useProjectVariablesStore } from '../../stores/projectVariables.js';
import wsClient from '../../services/wsClient.js';
import { useAuthStore } from '../../stores/auth.js';

const { register } = useCommandRegistry();

register({
  name: '/proyecto_var_eliminar',
  category: 'Proyecto',
  description: 'Elimina una variable de un proyecto.',
  usage: '/proyecto_var_eliminar --key=nombre [--id=proyecto]',
  async autocomplete(args, cmdStore) {
    const usedFlags = getUsedFlags(args)
    const keyInUse = usedFlags.some(f => f === '--key=' || f === '--key')
    const idInUse = usedFlags.some(f => f === '--id=' || f === '--id')

    if (!keyInUse) {
      const idFlag = args.find(a => a.startsWith('--id='))
      let proyectoId = idFlag ? idFlag.slice(5) : null
      if (!proyectoId) {
        const chatStore = (await import('../../stores/chat.js')).useChatStore()
        const activeSessionId = chatStore.activeSessionId
        if (activeSessionId) {
          const session = chatStore.sessions.find(s => s.id === activeSessionId)
          proyectoId = session?.proyecto_id || null
        }
      }
      if (proyectoId) {
        try {
          const auth = useAuthStore()
          const data = await wsClient.send('proyectoVarListar', {
            sessionToken: auth.getSessionToken(),
            proyectoId,
          })
          if (data.variables && data.variables.length > 0) {
            const projectKeys = data.variables.map(v => `--key=${v.key}`)
            cmdStore.showAutocomplete(projectKeys)
            return
          }
        } catch (err) {
          console.error('Error al obtener variables para autocomplete:', err.message)
        }
      }
      cmdStore.showAutocomplete(['--key='])
      return
    }

    const suggestions = []
    if (!idInUse) suggestions.push('--id=')
    cmdStore.showAutocomplete(suggestions)
  },
  async execute(args, { chatStore, sessionId }) {
    if (!sessionId) {
      throw new Error('Primero debe iniciar una sesión de chat.')
    }

    const schema = {
      key: { required: true, type: 'text' },
      id: { required: false, type: 'text' },
    }
    const { params, errors } = parseCommandArgs(args, schema)
    if (errors.length > 0) {
      throw new Error(errors.join('\n'))
    }

    let proyectoId = params.id
    if (!proyectoId) {
      try {
        const res = await fetch(`/api/proyecto/session/${sessionId}`, { credentials: 'include' })
        const data = await res.json()
        proyectoId = data.proyectoId
      } catch (err) {
        console.error('Error al obtener proyecto de sesión:', err.message)
      }
    }

    if (!proyectoId) {
      throw new Error('No hay proyecto definido. Use --id=proyecto o asigne un proyecto a la sesión.')
    }

    try {
      const auth = useAuthStore()
      const data = await wsClient.send('proyectoVarEliminar', {
        sessionToken: auth.getSessionToken(),
        proyectoId,
        key: params.key,
      })
      if (!data.success) throw new Error(data.error || 'Error al eliminar variable')
      const pvStore = useProjectVariablesStore()
      await pvStore.loadVariables(proyectoId)
      return `Variable "${params.key}" eliminada correctamente de "${proyectoId}"`
    } catch (err) {
      console.error('Error en /proyecto_var_eliminar:', err.message)
      throw err
    }
  },
})
