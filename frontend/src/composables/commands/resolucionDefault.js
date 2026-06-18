import { useCommandRegistry } from '../useCommandRegistry.js'

const { register } = useCommandRegistry()

register({
  name: '/resolucion_default',
  category: 'Navegador',
  description: 'Muestra la resolución de pantalla por defecto configurada.',
  usage: '/resolucion_default',
  async execute(args, { chatStore }) {
    const defaultRes = await fetch('/api/command/setting/default_resolution', { credentials: 'include' }).then(r => r.json())

    const resolutionId = defaultRes.value || ''
    if (!resolutionId) {
      chatStore.messages.push({
        role: 'result',
        content: 'No hay resolución por defecto configurada. Usá /resoluciones_get_all para establecer una.',
        _key: 'res-' + Date.now(),
      })
      return
    }

    const settingsRes = await fetch('/api/settings', { credentials: 'include' }).then(r => r.json())
    const resolutions = settingsRes.screen_resolutions || []
    const res = resolutions.find(r => r.id === resolutionId)

    if (!res) {
      chatStore.messages.push({
        role: 'result',
        content: `La resolución por defecto "${resolutionId}" ya no está disponible en la configuración del workspace. Usá /resoluciones_get_all para actualizarla.`,
        _key: 'res-' + Date.now(),
      })
      return
    }

    chatStore.messages.push({
      role: 'result',
      content: `**Resolución por defecto:** ${res.id} — ${res.width}x${res.height}`,
      _key: 'res-' + Date.now(),
    })
  },
})
