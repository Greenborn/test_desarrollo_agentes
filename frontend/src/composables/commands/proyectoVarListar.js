import { useCommandRegistry } from '../useCommandRegistry.js';
import wsClient from '../../services/wsClient.js';
import { useAuthStore } from '../../stores/auth.js';
import { getUsedFlags } from '../parseCommandArgs.js';

const { register } = useCommandRegistry();
const ALL_FLAGS = ['--id=']

register({
  name: '/proyecto_var_listar',
  category: 'Proyecto',
  description: 'Lista las variables de un proyecto.',
  usage: '/proyecto_var_listar [--id=proyecto]',
  autocomplete(args, cmdStore) {
    const usedFlags = getUsedFlags(args)
    const suggestions = ALL_FLAGS.filter(f => {
      const base = f.split('=')[0]
      return !usedFlags.includes(f) && !usedFlags.includes(base)
    })
    if (suggestions.length > 0) {
      cmdStore.showAutocomplete(suggestions)
    } else {
      cmdStore.hideAutocomplete()
    }
  },
  async execute(args, { chatStore, sessionId }) {
    if (!sessionId) {
      throw new Error('Primero debe iniciar una sesión de chat.')
    }

    const idFlag = args.find(a => a.startsWith('--id='))
    let proyectoId = idFlag ? idFlag.slice(5) : null

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
      const data = await wsClient.send('proyectoVarListar', {
        sessionToken: auth.getSessionToken(),
        proyectoId,
      })

      if (!data.variables || data.variables.length === 0) {
        return `(sin variables para el proyecto "${proyectoId}")`
      }

      const lines = data.variables.map(v => `${v.key}=${v.value}`)
      return `Variables de "${proyectoId}":\n${lines.join('\n')}`
    } catch (err) {
      console.error('Error en /proyecto_var_listar:', err.message)
      throw err
    }
  },
})
