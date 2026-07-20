import { useCommandRegistry } from '../useCommandRegistry.js'
import { parseCommandArgs } from '../parseCommandArgs.js'

const { register } = useCommandRegistry()

register({
  name: '/opencode_sync_skills',
  category: 'Skills',
  description: 'Sincroniza los paths de skills de los espacios de trabajo seleccionados en la configuración de OpenCode del proyecto (.opencode/opencode.json).',
  usage: '/opencode_sync_skills',
  async autocomplete(args, cmdStore) {
    cmdStore.hideAutocomplete()
  },
  async execute(args, { chatStore }) {
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
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error || 'Error al sincronizar skills')

      const lines = [data.message]
      if (data.config?.skills?.paths?.length) {
        lines.push('')
        lines.push('**Paths en la configuración del proyecto:**')
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
