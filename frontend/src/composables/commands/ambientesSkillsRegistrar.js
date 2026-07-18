import { useCommandRegistry } from '../useCommandRegistry.js'
import { useWorkspaceStore } from '../../stores/workspace.js'
import { parseCommandArgs, getUsedFlags } from '../parseCommandArgs.js'

const { register } = useCommandRegistry()

register({
  name: '/ambientes_skills_registrar',
  category: 'Skills',
  description: 'Registra las rutas absolutas de skills de ambientes de trabajo en la configuración global de OpenCode (~/.config/opencode/opencode.json).',
  usage: '/ambientes_skills_registrar [--slug=<workspace_slug>]',
  async autocomplete(args, cmdStore) {
    const usedFlags = getUsedFlags(args)
    if (usedFlags.includes('--slug=')) {
      const slugArg = args.find(a => a.startsWith('--slug='))
      const val = slugArg.slice('--slug='.length)
      const workspaceStore = useWorkspaceStore()
      const workspaces = workspaceStore.workspaces || []
      const filtered = val
        ? workspaces.filter(w => w.slug?.toLowerCase().includes(val) || w.name?.toLowerCase().includes(val))
        : workspaces
      if (filtered.length === 0 || (val && filtered.length === 1 && filtered[0].slug === val)) {
        cmdStore.hideAutocomplete()
      } else {
        cmdStore.showAutocomplete(
          filtered.map(w => ({
            display: `${w.name} (${w.slug})`,
            value: `--slug=${w.slug}`,
          }))
        )
      }
    } else {
      cmdStore.showAutocomplete(['--slug='])
    }
  },
  async execute(args, { chatStore }) {
    const { params, errors } = parseCommandArgs(args, {
      slug: { required: false },
    })
    if (errors.length > 0) {
      chatStore.messages.push({
        role: 'result',
        content: errors.join('. '),
        _key: 'skills-err-' + Date.now(),
      })
      return
    }

    try {
      const body = {}
      if (params.slug) body.slug = params.slug

      const res = await fetch('/api/opencode/register-skills-global', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify(body),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error || 'Error al registrar skills')

      const lines = [data.message]
      if (data.config?.skills?.paths?.length) {
        lines.push('')
        lines.push('**Paths registrados:**')
        for (const p of data.config.skills.paths) {
          lines.push(`- \`${p}\``)
        }
      }
      chatStore.messages.push({
        role: 'result',
        content: lines.join('\n'),
        _key: 'skills-ok-' + Date.now(),
      })
    } catch (err) {
      console.error('Error en /ambientes_skills_registrar:', err.message)
      chatStore.messages.push({
        role: 'result',
        content: `Error: ${err.message}`,
        _key: 'skills-err-' + Date.now(),
      })
    }
  },
})
