import { useCommandRegistry } from '../useCommandRegistry.js'
import { parseCommandArgs, getUsedFlags } from '../parseCommandArgs.js'

const { register } = useCommandRegistry()
const ALL_FLAGS = ['--id=']

register({
  name: '/navegador_grabacion_acciones',
  category: 'Navegador',
  description: 'Genera un arreglo JSON de acciones a partir de los eventos de una grabación, ordenado del más antiguo al más reciente.',
  usage: '/navegador_grabacion_acciones --id=<id>',
  async autocomplete(args, cmdStore) {
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
  async execute(args, { chatStore }) {
    const { params, errors } = parseCommandArgs(args, { id: { required: true, type: 'number' } })
    if (errors.length > 0) {
      throw new Error(errors.join('. '))
    }

    const res = await fetch(`/api/playwright-logs/events?recording_id=${params.id}&order=asc`, {
      credentials: 'include',
    })
    if (!res.ok) {
      const data = await res.json()
      throw new Error(data.error || 'Error al obtener eventos')
    }

    const events = await res.json()
    const actions = events.map(eventToAction).filter(Boolean)

    if (actions.length === 0) {
      return `No se generaron acciones a partir de los ${events.length} eventos de la grabación #${params.id}.`
    }

    return `Acciones generadas para grabación #${params.id} (${actions.length} acciones):\n\n${JSON.stringify(actions, null, 2)}`
  },
})
