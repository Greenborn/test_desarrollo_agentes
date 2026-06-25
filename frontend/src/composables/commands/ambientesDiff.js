import { useCommandRegistry } from '../useCommandRegistry.js'
import { parseCommandArgs, getUsedFlags } from '../parseCommandArgs.js'

const { register } = useCommandRegistry()

register({
  name: '/ambientes_diff',
  category: 'Ambientes',
  description: 'Lista los commits que diferen dos ambientes (ramas), ordenados por fecha ascendente, con enlace a GitHub.',
  usage: '/ambientes_diff --origen=<nombre> --destino=<nombre>',
  async autocomplete(args, cmdStore) {
    const usedFlags = getUsedFlags(args)

    const origenArg = args.find(a => a.startsWith('--origen='))
    const destinoArg = args.find(a => a.startsWith('--destino='))

    if (origenArg) {
      const val = origenArg.slice('--origen='.length)
      if (!val && !usedFlags.includes('--destino') && !destinoArg) {
        cmdStore.showAutocomplete(['--origen=', '--destino='])
        return
      }
    }

    if (!usedFlags.includes('--origen') && !origenArg) {
      try {
        const res = await fetch('/api/environments', { credentials: 'include' })
        const data = await res.json()
        const envs = data.environments || []
        const prefix = (origenArg || '').split('=')[1] || ''
        const filtered = envs.filter(e => e.name.toLowerCase().includes(prefix.toLowerCase()))
        cmdStore.showAutocomplete(filtered.map(e => ({ display: `${e.name} — ${e.branch}`, value: `--origen=${e.name}` })))
        return
      } catch (err) {
        console.error('Error en autocomplete de ambientes:', err.message)
        cmdStore.showAutocomplete(['--origen='])
        return
      }
    }

    if (destinoArg) {
      const val = destinoArg.slice('--destino='.length)
      if (val) {
        cmdStore.hideAutocomplete()
        return
      }
    }

    if (origenArg && !destinoArg && !usedFlags.includes('--destino')) {
      try {
        const res = await fetch('/api/environments', { credentials: 'include' })
        const data = await res.json()
        const envs = data.environments || []
        const prefix = (destinoArg || '').split('=')[1] || ''
        const filtered = envs.filter(e => e.name.toLowerCase().includes(prefix.toLowerCase()))
        cmdStore.showAutocomplete(filtered.map(e => ({ display: `${e.name} — ${e.branch}`, value: `--destino=${e.name}` })))
        return
      } catch (err) {
        console.error('Error en autocomplete de ambientes:', err.message)
        cmdStore.showAutocomplete(['--destino='])
        return
      }
    }

    const remaining = ['--destino='].filter(f => !usedFlags.includes(f) && !args.find(a => a.startsWith(f)))
    if (remaining.length > 0) {
      cmdStore.showAutocomplete(remaining)
    } else {
      cmdStore.hideAutocomplete()
    }
  },
  async execute(args, { chatStore, sessionId }) {
    if (!sessionId) {
      throw new Error('Primero debe iniciar una sesión de chat.')
    }

    const session = chatStore.sessions.find(s => s.id === sessionId)
    if (!session || !session.cwd) {
      throw new Error('La sesión no tiene un directorio de trabajo definido. Use /cd para establecerlo.')
    }

    const { params, errors } = parseCommandArgs(args, {
      origen: { required: true },
      destino: { required: true },
    })
    if (errors.length > 0) {
      throw new Error(errors.join('. '))
    }

    try {
      const res = await fetch('/api/command/git-diff-branches', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({
          sessionId,
          sourceEnv: params.origen,
          targetEnv: params.destino,
        }),
      })
      const data = await res.json()

      if (!data.success) {
        throw new Error(data.error || 'Error al obtener diferencias')
      }

      if (!data.commits || data.commits.length === 0) {
        chatStore.pushMessage({
          role: 'result',
          content: data.message
            ? `**${params.origen} ↔ ${params.destino}:** ${data.message}`
            : `**${params.origen} ↔ ${params.destino}:** No hay diferencias entre las ramas.`,
          _key: 'diff-' + Date.now(),
        }, sessionId)
        return
      }

      let output = `**Diferencias entre ${data.sourceEnv} (${data.sourceBranch}) → ${data.targetEnv} (${data.targetBranch}):**\n\n`

      for (const c of data.commits) {
        const url = c.githubUrl || `${data.remoteUrl}/commit/${c.hash}`
        output += `- ${c.message}: ${url}\n`
      }

      chatStore.pushMessage({
        role: 'result',
        content: output,
        _key: 'diff-' + Date.now(),
      }, sessionId)
    } catch (err) {
      console.error('Error en /ambientes_diff:', err.message)
      chatStore.pushMessage({
        role: 'result',
        content: `Error: ${err.message}`,
        _key: 'diff-err-' + Date.now(),
      }, sessionId)
    }
  },
})
