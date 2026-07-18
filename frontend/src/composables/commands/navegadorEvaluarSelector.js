import { useCommandRegistry } from '../useCommandRegistry.js';
import { parseCommandArgs, getUsedFlags } from '../parseCommandArgs.js';

const { register } = useCommandRegistry();

register({
  name: '/navegador_evaluar_selector',
  category: 'Navegador',
  description: 'Evalúa un selector CSS en la página activa del navegador y devuelve el valor solicitado.',
  usage: '/navegador_evaluar_selector --selector=<css> [--tipo=<value|text|html|attribute|checked|exists|count>] [--atributo=<nombre>]',
  async autocomplete(args, cmdStore) {
    const usedFlags = getUsedFlags(args)
    const selectorFlag = args.find(a => a.startsWith('--selector='))
    const tipoFlag = args.find(a => a.startsWith('--tipo='))
    const atributoFlag = args.find(a => a.startsWith('--atributo='))

    if (!selectorFlag && usedFlags.length === 0) {
      cmdStore.showAutocomplete(['--selector='])
      return
    }

    if (selectorFlag && !tipoFlag && !usedFlags.includes('--tipo')) {
      const selectorVal = selectorFlag.slice('--selector='.length)
      if (selectorVal) {
        cmdStore.showAutocomplete([
          { display: 'value — valor del input', value: '--tipo=value' },
          { display: 'text — texto del elemento', value: '--tipo=text' },
          { display: 'html — HTML interno', value: '--tipo=html' },
          { display: 'attribute — atributo específico', value: '--tipo=attribute' },
          { display: 'checked — input checkbox checked', value: '--tipo=checked' },
          { display: 'exists — si el elemento existe', value: '--tipo=exists' },
          { display: 'count — cantidad de elementos', value: '--tipo=count' },
        ])
      } else {
        cmdStore.showAutocomplete(['--selector='])
      }
      return
    }

    if (tipoFlag) {
      const tipoVal = tipoFlag.slice('--tipo='.length)
      if (tipoVal === 'attribute' && !atributoFlag && !usedFlags.includes('--atributo')) {
        cmdStore.showAutocomplete(['--atributo='])
        return
      }
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
      atributo: { required: false },
    })
    if (errors.length > 0) {
      throw new Error(errors.join('. '))
    }

    const selector = params.selector
    const extractType = params.tipo || 'value'
    const attributeName = params.atributo || null

    const validTypes = ['value', 'text', 'html', 'attribute', 'checked', 'exists', 'count']
    if (!validTypes.includes(extractType)) {
      throw new Error(`Tipo de extracción inválido: "${extractType}". Válidos: ${validTypes.join(', ')}`)
    }
    if (extractType === 'attribute' && !attributeName) {
      throw new Error('Para tipo "attribute" debe especificar --atributo=<nombre>.')
    }

    chatStore.messages[loadingIdx].content = `Consultando "${selector}" (${extractType})...`

    const apiParams = { selector, extract_type: extractType }
    if (attributeName) apiParams.attribute_name = attributeName

    const res = await fetch('/api/navegador/command', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      credentials: 'include',
      body: JSON.stringify({ comando: 'evaluate_selector', parametros: apiParams, sessionId }),
    })

    const data = await res.json()
    if (!res.ok || data.error) {
      throw new Error(data.error || 'Error al evaluar selector')
    }

    if (!data.found) {
      return `🔍 Selector "${selector}" (${extractType}): Elemento no encontrado`
    }

    const valueStr = data.value !== null && data.value !== undefined ? String(data.value) : 'null'
    return `🔍 Selector "${selector}" (${extractType}): ${valueStr}`
  },
})
