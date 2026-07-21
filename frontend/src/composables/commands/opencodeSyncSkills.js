import { useCommandRegistry } from '../useCommandRegistry.js'
import { parseCommandArgs } from '../parseCommandArgs.js'

const { register } = useCommandRegistry()

register({
  name: '/opencode_sync_skills',
  category: 'Skills',
  description: 'Copia los skills de los espacios de trabajo seleccionados a .opencode/skills/ del proyecto.',
  usage: '/opencode_sync_skills',
  async autocomplete(args, cmdStore) {
    cmdStore.hideAutocomplete()
  },
  async execute(args, { chatStore, sessionId }) {
    if (!sessionId) {
      chatStore.messages.push({
        role: 'result',
        content: 'Primero debe iniciar una sesión de chat.',
        _key: 'sync-err-' + Date.now(),
      })
      return
    }

    const { errors } = parseCommandArgs(args, {})
    if (errors.length > 0) {
      chatStore.messages.push({
        role: 'result',
        content: errors.join('. '),
        _key: 'sync-err-' + Date.now(),
      })
      return
    }

    try {
      const res = await fetch('/api/opencode/sync-skills-project', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ sessionId }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error || 'Error al sincronizar skills')

      const lines = [data.message]
      if (data.config?.skills?.paths?.length) {
        lines.push('')
        lines.push('**Paths en la configuración:**')
        for (const p of data.config.skills.paths) {
          lines.push(`- \`${p}\``)
        }
      }
      chatStore.messages.push({
        role: 'result',
        content: lines.join('\n'),
        _key: 'sync-ok-' + Date.now(),
      })
    } catch (err) {
      console.error('Error en /opencode_sync_skills:', err.message)
      chatStore.messages.push({
        role: 'result',
        content: `Error: ${err.message}`,
        _key: 'sync-err-' + Date.now(),
      })
    }
  },
})
