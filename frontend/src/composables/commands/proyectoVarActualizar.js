import { useCommandRegistry } from '../useCommandRegistry.js';
import { parseCommandArgs } from '../parseCommandArgs.js';
import { useProjectVariablesStore } from '../../stores/projectVariables.js';
import wsClient from '../../services/wsClient.js';
import { useAuthStore } from '../../stores/auth.js';

const { register } = useCommandRegistry();

register({
  name: '/proyecto_var_actualizar',
  category: 'Proyecto',
  description: 'Actualiza el valor de una variable existente en un proyecto. Usar --type=memory|db para cambiar persistencia.',
  usage: '/proyecto_var_actualizar --key=nombre --value=valor [--id=proyecto] [--type=db|memory]',
  async autocomplete(args, cmdStore) {
    const usedFlags = args.filter(a => a.startsWith('--'))
    const hasKey = usedFlags.some(a => a.startsWith('--key='))
    const hasValue = usedFlags.some(a => a.startsWith('--value='))
    const hasId = usedFlags.some(a => a.startsWith('--id='))

    if (!hasKey) {
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

    const hasType = usedFlags.some(a => a.startsWith('--type='))
    const suggestions = []
    if (!hasValue) suggestions.push('--value=')
    if (!hasId) suggestions.push('--id=')
    if (!hasType) suggestions.push('--type=db', '--type=memory')
    cmdStore.showAutocomplete(suggestions)
  },
  async execute(args, { chatStore, sessionId }) {
    if (!sessionId) {
      throw new Error('Primero debe iniciar una sesión de chat.')
    }

    const schema = {
      key: { required: true, type: 'text' },
      value: { required: true, type: 'text' },
      id: { required: false, type: 'text' },
      type: { required: false, type: 'text' },
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
      const data = await wsClient.send('proyectoVarActualizar', {
        sessionToken: auth.getSessionToken(),
        proyectoId,
        key: params.key,
        value: params.value,
        type: params.type,
      })
      if (!data.success) throw new Error(data.error || 'Error al actualizar variable')
      const pvStore = useProjectVariablesStore()
      await pvStore.loadVariables(proyectoId)
      return `Variable "${params.key}" actualizada correctamente en "${proyectoId}"`
    } catch (err) {
      console.error('Error en /proyecto_var_actualizar:', err.message)
      throw err
    }
  },
})
