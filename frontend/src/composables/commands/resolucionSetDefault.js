import { useCommandRegistry } from '../useCommandRegistry.js'
import { settingSet } from '../../services/settingService.js'

const { register } = useCommandRegistry()

async function fetchResolutions() {
  try {
    const res = await fetch('/api/settings', { credentials: 'include' })
    const data = await res.json()
    return data.screen_resolutions || []
  } catch (err) {
    console.error('Error al obtener resoluciones:', err.message)
    return []
  }
}

register({
  name: '/resolucion_set_default',
  category: 'Navegador',
  description: 'Establece la resolución de pantalla por defecto.',
  usage: '/resolucion_set_default --resolucion=<ID>',
  async autocomplete(args, cmdStore) {
    const resolucionArg = args.find(a => a.startsWith('--resolucion='))
    if (resolucionArg) {
      const resolutions = await fetchResolutions()
      if (!resolutions.length) {
        cmdStore.hideAutocomplete()
        return
      }
      const val = resolucionArg.slice('--resolucion='.length)
      if (val && resolutions.find(r => r.id === val)) {
        cmdStore.hideAutocomplete()
        return
      }
      if (!val) {
        cmdStore.showAutocomplete(
          resolutions.map(r => ({
            display: `${r.id} — ${r.width}x${r.height}`,
            value: `--resolucion=${r.id}`,
          }))
        )
        return
      }
      const prefix = val.toLowerCase()
      const filtered = resolutions.filter(r => r.id.toLowerCase().includes(prefix))
      cmdStore.showAutocomplete(
        filtered.map(r => ({
          display: `${r.id} — ${r.width}x${r.height}`,
          value: `--resolucion=${r.id}`,
        }))
      )
      return
    }

    cmdStore.showAutocomplete(['--resolucion='])
  },
  async execute(args, { chatStore }) {
    const resolucionArg = args.find(a => a.startsWith('--resolucion='))
    if (!resolucionArg) {
      throw new Error('Parámetro requerido: --resolucion=<ID>. Usá /resoluciones_get_all para ver las resoluciones disponibles.')
    }

    const resolutionId = resolucionArg.slice('--resolucion='.length)
    if (!resolutionId) {
      throw new Error('El parámetro --resolucion= no puede estar vacío.')
    }

    const resolutions = await fetchResolutions()
    const resolution = resolutions.find(r => r.id === resolutionId)
    if (!resolution) {
      const avail = resolutions.map(r => r.id).join(', ')
      throw new Error(`Resolución no válida: "${resolutionId}". Resoluciones disponibles: ${avail || '(ninguna configurada)'}`)
    }

    await settingSet('default_resolution', resolutionId)

    chatStore.messages.push({
      role: 'result',
      content: `**Resolución por defecto establecida:** ${resolution.id} — ${resolution.width}x${resolution.height}`,
      _key: 'res-' + Date.now(),
    })
  },
})
