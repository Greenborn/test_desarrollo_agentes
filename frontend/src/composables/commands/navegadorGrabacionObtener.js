import { useCommandRegistry } from '../useCommandRegistry.js'
import { parseCommandArgs } from '../parseCommandArgs.js'

const { register } = useCommandRegistry()

register({
  name: '/navegador_grabacion_obtener',
  category: 'Navegador',
  description: 'Obtiene información de una grabación de eventos por su ID.',
  usage: '/navegador_grabacion_obtener --id=<id>',
  async autocomplete(args, cmdStore) {
    const idArg = args.find(a => a.startsWith('--id='))
    if (!idArg) {
      cmdStore.showAutocomplete(['--id='])
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
