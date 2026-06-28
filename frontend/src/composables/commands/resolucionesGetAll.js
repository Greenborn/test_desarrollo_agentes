import { useCommandRegistry } from '../useCommandRegistry.js'
import { settingGet } from '../../services/settingService.js'

const { register } = useCommandRegistry()

register({
  name: '/resoluciones_get_all',
  category: 'Navegador',
  description: 'Muestra las resoluciones de pantalla configuradas.',
  usage: '/resoluciones_get_all',
  async execute(args, { chatStore }) {
    const [settingsRes, defaultRes] = await Promise.all([
      fetch('/api/settings', { credentials: 'include' }).then(r => r.json()),
      settingGet('default_resolution'),
    ])

    const resolutions = settingsRes.screen_resolutions || []
    if (!resolutions.length) {
      chatStore.messages.push({
        role: 'result',
        content: 'No hay resoluciones configuradas. Agregálas desde Configuración → Resoluciones de Pantalla.',
        _key: 'res-' + Date.now(),
      })
      return
    }

    const defaultId = defaultRes.value || ''
    const lines = resolutions.map(r => {
      const marker = r.id === defaultId ? ' ✅ (por defecto)' : ''
      return `  • ${r.id} — ${r.width}x${r.height}${marker}`
    })

    chatStore.messages.push({
      role: 'result',
      content: `**Resoluciones disponibles:**\n${lines.join('\n')}\n\nUsá \`/resolucion_set_default --resolucion=ID\` para cambiar la resolución por defecto.`,
      _key: 'res-' + Date.now(),
    })
  },
})
