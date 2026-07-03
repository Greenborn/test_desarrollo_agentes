import { useCommandRegistry } from '../useCommandRegistry.js'
import { parseCommandArgs, getUsedFlags } from '../parseCommandArgs.js'

const { register } = useCommandRegistry()
const ALL_FLAGS = ['--id=']

register({
  name: '/navegador_grabacion_obtener',
  category: 'Navegador',
  description: 'Obtiene información de una grabación de eventos por su ID.',
  usage: '/navegador_grabacion_obtener --id=<id>',
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

    const res = await fetch(`/api/playwright-logs/event-recordings/${params.id}`, {
      credentials: 'include',
    })
    if (!res.ok) {
      const data = await res.json()
      throw new Error(data.error || 'Error al obtener grabación')
    }

    const rec = await res.json()
    return [
      `Grabación #${rec.id}: ${rec.name}`,
      `Proyecto: ${rec.project_id || '(sin proyecto)'}`,
      `Eventos: ${rec.event_count}`,
      `Creada: ${rec.created_at}`,
      '',
      JSON.stringify(rec, null, 2),
    ].join('\n')
  },
})
