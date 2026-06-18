import { useCommandRegistry } from '../useCommandRegistry.js'

const { register } = useCommandRegistry()

register({
  name: '/resoluciones_get_all',
  category: 'Navegador',
  description: 'Muestra las resoluciones de pantalla configuradas con opción para establecer una por defecto.',
  usage: '/resoluciones_get_all',
  async execute(args, { chatStore }) {
    const [settingsRes, defaultRes] = await Promise.all([
      fetch('/api/settings', { credentials: 'include' }).then(r => r.json()),
      fetch('/api/command/setting/default_resolution', { credentials: 'include' }).then(r => r.json()),
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

    chatStore.messages.push({
      role: 'opencode_control',
      controlData: {
        controlId: 'res-default-' + Date.now(),
        controlType: 'resolution_select',
        stepType: 'resolution_set_default',
        options: resolutions.map(r => ({
          label: `${r.id} — ${r.width}x${r.height}`,
          value: r.id,
        })),
        preselect: defaultId || '',
      },
      _key: 'ctrl-' + Date.now(),
    })
  },
})
