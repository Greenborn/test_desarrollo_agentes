import { useCommandRegistry } from '../useCommandRegistry.js';
import { parseCommandArgs } from '../parseCommandArgs.js';
import { useProjectVariablesStore } from '../../stores/projectVariables.js';

const { register } = useCommandRegistry();

register({
  name: '/proyecto_var_crear',
  category: 'Proyecto',
  description: 'Crea una nueva variable en un proyecto.',
  usage: '/proyecto_var_crear --key=nombre --value=valor [--id=proyecto]',
  autocomplete(args, cmdStore) {
    const usedFlags = args.filter(a => a.startsWith('--'))
    const hasKey = usedFlags.some(a => a.startsWith('--key='))
    const hasValue = usedFlags.some(a => a.startsWith('--value='))
    const hasId = usedFlags.some(a => a.startsWith('--id='))
    const suggestions = []
    if (!hasKey) suggestions.push('--key=')
    if (!hasValue) suggestions.push('--value=')
    if (!hasId) suggestions.push('--id=')
    return suggestions
  },
  async execute(args, { chatStore, sessionId }) {
    if (!sessionId) {
      throw new Error('Primero debe iniciar una sesión de chat.')
    }

    const schema = {
      key: { required: true, type: 'text' },
      value: { required: true, type: 'text' },
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
      const res = await fetch(`/api/proyecto/${encodeURIComponent(proyectoId)}/variables`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ key: params.key, value: params.value }),
      })
      if (!res.ok) {
        const errData = await res.json()
        throw new Error(errData.error || 'Error al crear variable')
      }
      const pvStore = useProjectVariablesStore()
      await pvStore.loadVariables(proyectoId)
      return `Variable "${params.key}" creada correctamente en "${proyectoId}"`
    } catch (err) {
      console.error('Error en /proyecto_var_crear:', err.message)
      throw err
    }
  },
})
