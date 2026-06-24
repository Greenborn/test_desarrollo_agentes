import { useCommandRegistry } from '../useCommandRegistry.js'
import { parseCommandArgs } from '../parseCommandArgs.js'

const { register } = useCommandRegistry()

function eventToAction(evt) {
  switch (evt.event_type) {
    case 'click':
    case 'dblclick':
      return { type: 'click', selector: evt.selector, text: evt.text_content, url: evt.url }
    case 'input':
      return { type: 'fill', selector: evt.selector, value: evt.value, text: evt.text_content }
    case 'change':
      return { type: 'select', selector: evt.selector, value: evt.value, text: evt.text_content }
    case 'submit':
      return { type: 'submit', selector: evt.selector, text: evt.text_content }
    case 'keydown':
      return { type: 'press', key: evt.key, selector: evt.selector }
    case 'scroll':
      return { type: 'scroll', x: evt.scroll_x, y: evt.scroll_y }
    default:
      return null
  }
}

register({
  name: '/navegador_grabacion_reproducir',
  category: 'Navegador',
  description: 'Reproduce una grabación de eventos en la instancia de navegador activa. Requiere sesión de navegador Playwright activa. Cada acción se ejecuta con un intervalo configurable.',
  usage: '/navegador_grabacion_reproducir --id=<id> [--intervalo=<ms>]',
  async autocomplete(args, cmdStore) {
    const idArg = args.find(a => a.startsWith('--id='))
    const intervalArg = args.find(a => a.startsWith('--intervalo='))
    if (!idArg) {
      try {
        const res = await fetch('/api/playwright-logs/event-recordings', { credentials: 'include' })
        const data = await res.json()
        const recordings = data.recordings || []
        cmdStore.showAutocomplete(recordings.map(r => ({ display: `#${r.id} "${r.name}"`, value: `--id=${r.id}` })))
      } catch {
        cmdStore.showAutocomplete(['--id='])
      }
    } else if (!intervalArg) {
      cmdStore.showAutocomplete(['--intervalo='])
    } else {
      cmdStore.hideAutocomplete()
    }
  },
  async execute(args, { chatStore, loadingIdx }) {
    const { params, errors } = parseCommandArgs(args, {
      id: { required: true, type: 'number' },
      intervalo: { required: false, type: 'number' },
    })
    if (errors.length > 0) {
      throw new Error(errors.join('. '))
    }

    const recordingId = params.id
    const intervalo = Math.max(200, params.intervalo || 1000)

    const statusRes = await fetch('/api/navegador/status', { credentials: 'include' })
    const status = await statusRes.json()
    if (!status.hasActiveSession) {
      throw new Error('No hay una instancia de navegador Playwright activa. Use /navegador_iniciar para iniciar una.')
    }

    const eventsRes = await fetch(`/api/playwright-logs/events?recording_id=${recordingId}&order=asc`, { credentials: 'include' })
    if (!eventsRes.ok) {
      const data = await eventsRes.json()
      throw new Error(data.error || 'Error al obtener eventos de la grabación')
    }
    const events = await eventsRes.json()

    if (events.length === 0) {
      return `La grabación #${recordingId} no tiene eventos.`
    }

    const actions = events.map(eventToAction).filter(Boolean)
    if (actions.length === 0) {
      return `No se pudieron generar acciones a partir de los ${events.length} eventos de la grabación #${recordingId}.`
    }

    const total = actions.length
    let ejecutadas = 0
    let errores = 0

    const sessionId = chatStore.activeSessionId

    for (let i = 0; i < total; i++) {
      const a = actions[i]
      const step = i + 1
      const label = a.type === 'click' ? `Click en "${a.selector}"` :
        a.type === 'fill' ? `Completar "${a.selector}" → "${a.value}"` :
        a.type === 'select' ? `Seleccionar "${a.selector}" → "${a.value}"` :
        a.type === 'submit' ? `Enviar formulario "${a.selector}"` :
        a.type === 'press' ? `Presionar "${a.key}" en "${a.selector}"` :
        a.type === 'scroll' ? `Scroll a x=${a.x}, y=${a.y}` :
        `Acción ${a.type}`

      const msg = chatStore.messages[loadingIdx]
      if (msg) {
        chatStore.messages[loadingIdx] = { ...msg, content: `⏳ Reproduciendo: [${step}/${total}] ${label}...` }
      }

      let ok = false
      let errorMsg = ''
      try {
        const res = await fetch('/api/navegador/command', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          credentials: 'include',
          body: JSON.stringify({
            comando: 'execute_action',
            parametros: { action: a },
            sessionId,
          }),
        })
        const data = await res.json()
        if (data.error) {
          errorMsg = data.error
        } else {
          ok = true
          ejecutadas++
        }
      } catch (err) {
        errorMsg = err.message
      }

      if (!ok) {
        errores++
        errorMsg = errorMsg || 'Error desconocido'
      }

      const stepMsg = ok
        ? { role: 'result', content: `✅ [${step}/${total}] ${label}` }
        : { role: 'result', content: `❌ [${step}/${total}] ${label} — Error: ${errorMsg}` }

      chatStore.messages.push(stepMsg)
      if (sessionId) {
        chatStore._saveMessageToDb(sessionId, stepMsg)
      }

      if (i < total - 1) {
        await new Promise(r => setTimeout(r, intervalo))
      }
    }

    return `✅ Reproducción finalizada.\nTotal: ${total} acciones, Ejecutadas: ${ejecutadas}, Errores: ${errores}`
  },
})
