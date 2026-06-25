import { useCommandRegistry } from '../useCommandRegistry.js'

const { register } = useCommandRegistry()

register({
  name: '/navegador_extraer_formularios',
  category: 'Navegador',
  description: 'Extrae todos los controles de formulario de la página actual en el navegador.',
  usage: '/navegador_extraer_formularios',
  async execute(args, { chatStore, sessionId }) {
    if (!sessionId) {
      throw new Error('Primero debe iniciar una sesión de chat.')
    }

    const res = await fetch('/api/navegador/command', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      credentials: 'include',
      body: JSON.stringify({
        comando: 'extract_form_controls',
        parametros: {},
        sessionId,
      }),
    })
    const data = await res.json()

    if (data.error) {
      throw new Error(data.error)
    }

    const formCount = data.forms ? data.forms.length : 0
    const controlCount = data.controls ? data.controls.length : 0

    return [
      `Página: ${data.title}`,
      `URL: ${data.url}`,
      `Formularios: ${formCount}`,
      `Controles: ${controlCount}`,
      '',
      JSON.stringify(data, null, 2),
    ].join('\n')
  },
})
