import { useCommandRegistry } from '../useCommandRegistry.js'
import { parseCommandArgs } from '../parseCommandArgs.js'

const { register } = useCommandRegistry()

function eventToAction(evt) {
  switch (evt.event_type) {
    case 'click':
    case 'dblclick':
      return {
        type: 'click',
        selector: evt.selector || null,
        text: evt.text_content || null,
        url: evt.url || null,
        x: evt.x ?? null,
        y: evt.y ?? null,
      }
    case 'input':
      return {
        type: 'fill',
        selector: evt.selector || null,
        value: evt.value || null,
        text: evt.text_content || null,
      }
    case 'change':
      return {
        type: 'select',
        selector: evt.selector || null,
        value: evt.value || null,
        text: evt.text_content || null,
      }
    case 'submit':
      return {
        type: 'submit',
        selector: evt.selector || null,
        text: evt.text_content || null,
      }
    case 'keydown':
      return {
        type: 'press',
        key: evt.key || null,
        selector: evt.selector || null,
      }
    case 'scroll':
      return {
        type: 'scroll',
        x: evt.scroll_x ?? null,
        y: evt.scroll_y ?? null,
      }
    default:
      return null
  }
}

register({
  name: '/navegador_grabacion_acciones',
  category: 'Navegador',
  description: 'Genera un arreglo JSON de acciones a partir de los eventos de una grabación, ordenado del más antiguo al más reciente.',
  usage: '/navegador_grabacion_acciones --id=<id>',
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
