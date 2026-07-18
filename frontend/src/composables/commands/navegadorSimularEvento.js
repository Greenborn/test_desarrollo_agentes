import { useCommandRegistry } from '../useCommandRegistry.js';
import { parseCommandArgs, getUsedFlags } from '../parseCommandArgs.js';

const { register } = useCommandRegistry();

register({
  name: '/navegador_simular_evento',
  category: 'Navegador',
  description: 'Simula un evento DOM en un elemento de la página activa del navegador. Útil para pruebas automatizadas.',
  usage: '/navegador_simular_evento --selector=<css> [--tipo=<click|mouseenter|focus|blur|change|...>] [--opciones=<json>]',
  async autocomplete(args, cmdStore) {
    const usedFlags = getUsedFlags(args)
    const selectorFlag = args.find(a => a.startsWith('--selector='))
    const tipoFlag = args.find(a => a.startsWith('--tipo='))

    if (!selectorFlag && usedFlags.length === 0) {
      cmdStore.showAutocomplete(['--selector='])
      return
    }

    if (selectorFlag && !tipoFlag && !usedFlags.includes('--tipo')) {
      const sVal = selectorFlag.slice('--selector='.length)
      if (sVal) {
        cmdStore.showAutocomplete(['--tipo='])
      } else {
        cmdStore.showAutocomplete(['--selector='])
      }
      return
    }

    cmdStore.hideAutocomplete()
  },
  async execute(args, { chatStore, loadingIdx, sessionId }) {
    if (!sessionId) {
      throw new Error('Primero debe iniciar una sesión de chat.')
    }

    const { params, errors } = parseCommandArgs(args, {
      selector: { required: true },
      tipo: { required: false },
      opciones: { required: false },
    })
    if (errors.length > 0) {
      throw new Error(errors.join('. '))
    }

    const selector = params.selector
    const eventType = params.tipo || 'click'
    let eventInit = {}
    if (params.opciones) {
      try {
        eventInit = JSON.parse(params.opciones)
      } catch (e) {
        throw new Error(`Opciones JSON inválidas: "${params.opciones}". Debe ser un objeto JSON válido.`)
      }
    }

    chatStore.messages[loadingIdx].content = `Simulando evento "${eventType}" en "${selector}"...`

    const res = await fetch('/api/navegador/command', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      credentials: 'include',
      body: JSON.stringify({
        comando: 'simulate_event',
        parametros: { selector, event_type: eventType, event_init: eventInit },
        sessionId,
      }),
    })

    const data = await res.json()
    if (!res.ok || data.error) {
      throw new Error(data.error || 'Error al simular evento')
    }

    return `🎯 Evento "${eventType}" simulado en "${selector}" correctamente.`
  },
})
