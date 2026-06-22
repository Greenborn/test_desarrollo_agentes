import { useCommandRegistry } from '../useCommandRegistry.js';
import { parseCommandArgs } from '../parseCommandArgs.js';

const { register } = useCommandRegistry();

register({
  name: '/proyecto_var_eliminar',
  category: 'Proyecto',
  description: 'Elimina una variable de un proyecto.',
  usage: '/proyecto_var_eliminar --key=nombre [--id=proyecto]',
  autocomplete(args, cmdStore) {
    const usedFlags = args.filter(a => a.startsWith('--'))
    const hasKey = usedFlags.some(a => a.startsWith('--key='))
    const hasId = usedFlags.some(a => a.startsWith('--id='))
    const suggestions = []
    if (!hasKey) suggestions.push('--key=')
    if (!hasId) suggestions.push('--id=')
    return suggestions
  },
  async execute(args, { chatStore }) {
    const sessionId = chatStore.activeSessionId
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
      const res = await fetch(
        `/api/proyecto/${encodeURIComponent(proyectoId)}/variables/${encodeURIComponent(params.key)}`,
        {
          method: 'DELETE',
          credentials: 'include',
        },
      )
      if (!res.ok) {
        const errData = await res.json()
        throw new Error(errData.error || 'Error al eliminar variable')
      }
      return `Variable "${params.key}" eliminada correctamente de "${proyectoId}"`
    } catch (err) {
      console.error('Error en /proyecto_var_eliminar:', err.message)
      throw err
    }
  },
})
