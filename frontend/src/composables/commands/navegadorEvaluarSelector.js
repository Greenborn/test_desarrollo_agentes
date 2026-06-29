import { useCommandRegistry } from '../useCommandRegistry.js';

const { register } = useCommandRegistry();

register({
  name: '/navegador_evaluar_selector',
  category: 'Navegador',
  description: 'Evalúa un selector CSS en la página activa del navegador y devuelve el valor solicitado.',
  usage: '/navegador_evaluar_selector <selector> [tipo] [nombre_atributo]',
  async autocomplete(args, cmdStore) {
    const firstArg = args[0]
    if (!firstArg || firstArg.startsWith('#')) {
      cmdStore.showAutocomplete([
        { display: '#id — buscar por ID', value: '' },
        { display: '.clase — buscar por clase', value: '' },
        { display: 'input[name=\"x\"] — por atributo', value: '' },
      ])
      return
    }
    if (args.length === 1) {
      cmdStore.showAutocomplete([
        { display: 'value — valor del input', value: 'value' },
        { display: 'text — texto del elemento', value: 'text' },
        { display: 'html — HTML interno', value: 'html' },
        { display: 'attribute — atributo específico', value: 'attribute' },
        { display: 'checked — input checkbox checked', value: 'checked' },
        { display: 'exists — si el elemento existe', value: 'exists' },
        { display: 'count — cantidad de elementos', value: 'count' },
      ])
      return
    }
    cmdStore.hideAutocomplete()
  },
  async execute(args, { chatStore, loadingIdx, sessionId }) {
    if (!sessionId) {
      throw new Error('Primero debe iniciar una sesión de chat.')
    }

    const selector = args[0]
    if (!selector) {
      throw new Error('Debe especificar un selector CSS. Ej: /navegador_evaluar_selector #username value')
    }

    const extractType = args[1] || 'value'
    const attributeName = args[2] || null

    const validTypes = ['value', 'text', 'html', 'attribute', 'checked', 'exists', 'count']
    if (!validTypes.includes(extractType)) {
      throw new Error(`Tipo de extracción inválido: "${extractType}". Válidos: ${validTypes.join(', ')}`)
    }
    if (extractType === 'attribute' && !attributeName) {
      throw new Error('Para tipo "attribute" debe especificar el nombre del atributo. Ej: /navegador_evaluar_selector [data-id="5"] attribute data-value')
    }

    chatStore.messages[loadingIdx].content = `Consultando "${selector}" (${extractType})...`

    const params = { selector, extract_type: extractType }
    if (attributeName) params.attribute_name = attributeName

    const res = await fetch('/api/navegador/command', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      credentials: 'include',
      body: JSON.stringify({ comando: 'evaluate_selector', parametros: params, sessionId }),
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
