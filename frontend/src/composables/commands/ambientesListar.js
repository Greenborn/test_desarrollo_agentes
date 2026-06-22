import { useCommandRegistry } from '../useCommandRegistry.js'

const { register } = useCommandRegistry()

register({
  name: '/ambientes_listar',
  category: 'Ambientes',
  description: 'Lista los ambientes configurados (DEV, TST, PRD, etc.) con su rama y descripción.',
  usage: '/ambientes_listar',
  async execute(args, { chatStore }) {
    try {
      const res = await fetch('/api/environments', { credentials: 'include' })
      if (!res.ok) {
        const errData = await res.json()
        throw new Error(errData.error || 'Error al obtener ambientes')
      }
      const data = await res.json()

      if (!data.environments || data.environments.length === 0) {
        chatStore.messages.push({
          role: 'result',
          content: '(no hay ambientes configurados)',
          _key: 'env-' + Date.now(),
        })
        return
      }

      const lines = data.environments.map(e => `${e.name}: rama "${e.branch}" — ${e.description || '(sin descripción)'}`)
      chatStore.messages.push({
        role: 'result',
        content: `**Ambientes disponibles:**\n${lines.join('\n')}`,
        _key: 'env-' + Date.now(),
      })
    } catch (err) {
      console.error('Error en /ambientes_listar:', err.message)
      chatStore.messages.push({
        role: 'result',
        content: `Error: ${err.message}`,
        _key: 'env-err-' + Date.now(),
      })
    }
  },
})
