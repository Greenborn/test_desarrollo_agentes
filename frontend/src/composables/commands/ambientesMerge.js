import { useCommandRegistry } from '../useCommandRegistry.js'
import { parseCommandArgs, getUsedFlags } from '../parseCommandArgs.js'

const { register } = useCommandRegistry()

const COMENTAR_OPTIONS = ['enviar', 'encolar']

register({
  name: '/ambientes_merge',
  category: 'Ambientes',
  description: 'Hace merge de la rama actual a la rama del ambiente especificado, hace push y opcionalmente notifica a Redmine.',
  usage: '/ambientes_merge --ambiente=<nombre> [--mensaje=<texto>] [--comentar=<enviar|encolar>]',
  async autocomplete(args, cmdStore) {
    const usedFlags = getUsedFlags(args)

    const ambienteArg = args.find(a => a.startsWith('--ambiente='))
    const comentarArg = args.find(a => a.startsWith('--comentar='))

    if (ambienteArg) {
      const val = ambienteArg.slice('--ambiente='.length)
      if (!val && !usedFlags.includes('--comentar') && !comentarArg) {
        cmdStore.showAutocomplete(['--ambiente=', '--mensaje=', '--comentar='])
        return
      }
    }

    if (!usedFlags.includes('--ambiente') && !ambienteArg) {
      try {
        const res = await fetch('/api/environments', { credentials: 'include' })
        const data = await res.json()
        const envs = data.environments || []
        const prefix = (ambienteArg || '').split('=')[1] || ''
        const filtered = envs.filter(e => e.name.toLowerCase().includes(prefix.toLowerCase()))
        cmdStore.showAutocomplete(filtered.map(e => ({ display: `${e.name} — ${e.branch}`, value: `--ambiente=${e.name}` })))
        return
      } catch (err) {
        console.error('Error en autocomplete de ambientes:', err.message)
        cmdStore.showAutocomplete(['--ambiente='])
        return
      }
    }

    if (comentarArg) {
      const val = comentarArg.slice('--comentar='.length)
      if (val) {
        cmdStore.hideAutocomplete()
        return
      }
      cmdStore.showAutocomplete(COMENTAR_OPTIONS.map(o => ({ display: o, value: `--comentar=${o}` })))
      return
    }

    const remaining = ['--mensaje=', '--comentar='].filter(f => !usedFlags.includes(f) && !args.find(a => a.startsWith(f)))
    if (remaining.length > 0) {
      cmdStore.showAutocomplete(remaining)
    } else {
      cmdStore.hideAutocomplete()
    }
  },
  async execute(args, { chatStore }) {
    const sessionId = chatStore.activeSessionId
    if (!sessionId) {
      throw new Error('Primero debe iniciar una sesión de chat.')
    }

    const session = chatStore.sessions.find(s => s.id === sessionId)
    if (!session || !session.cwd) {
      throw new Error('La sesión no tiene un directorio de trabajo definido. Use /cd para establecerlo.')
    }

    const { params, errors } = parseCommandArgs(args, {
      ambiente: { required: true },
      mensaje: { required: false },
      comentar: { required: false },
    })
    if (errors.length > 0) {
      throw new Error(errors.join('. '))
    }

    const ambienteName = params.ambiente
    const rawMensaje = params.mensaje || `Se actualiza ambiente ${ambienteName}`
    const comentar = params.comentar || null

    if (comentar && !['enviar', 'encolar'].includes(comentar)) {
      throw new Error('--comentar debe ser "enviar" o "encolar"')
    }

    const mensaje = rawMensaje.replace(/\{\{nombre\}\}/g, ambienteName)

    if (comentar) {
      const ticketRes = await fetch(`/api/tickets/session/${sessionId}`, { credentials: 'include' })
      const ticketData = await ticketRes.json()
      if (!ticketData.idTicketRedmine) {
        return `No hay ticket asignado a la sesión. Use /chat_set_ticket para asignar uno, o ejecute sin --comentar.`
      }
    }

    try {
      const res = await fetch('/api/command/git-merge', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ sessionId, ambienteName, mensaje, comentar }),
      })
      const data = await res.json()

      if (!data.success) {
        throw new Error(data.error || 'Error al ejecutar merge')
      }

      if (data.hasConflicts) {
        chatStore.messages.push({
          role: 'result',
          content: `**Merge con conflictos en ${data.targetBranch}**\n\nSe hizo checkout a "${data.targetBranch}" pero hay conflictos al mergear "${data.sourceBranch}".\n\n\`\`\`\n${data.mergeOutput}\n\`\`\`\n\n${data.instruction}`,
          _key: 'merge-' + Date.now(),
        })
        return
      }

      let output = `**Merge completado: ${data.sourceBranch} → ${data.targetBranch}**\n`
      output += `\`\`\`\n${data.mergeOutput}\n\`\`\`\n`

      if (data.pushOutput) {
        output += `**Push a origin/${data.targetBranch}:**\n\`\`\`\n${data.pushOutput}\n\`\`\`\n`
      }
      if (data.pushError) {
        output += `**⚠ Push con error:**\n\`\`\`\n${data.pushError}\n\`\`\`\n`
      }

      if (data.redmineComment) {
        if (data.redmineComment.action === 'enviado') {
          output += `✅ Comentario enviado a Redmine ticket #${data.redmineComment.ticketId}.\n`
        } else if (data.redmineComment.action === 'encolado') {
          output += `📦 Comentario encolado para Redmine ticket #${data.redmineComment.ticketId}. Use /dev_redmine_comentarios_enviar para enviarlo.\n`
        } else if (data.redmineComment.action === 'error') {
          output += `⚠ Error al notificar a Redmine: ${data.redmineComment.error}\n`
        }
      } else if (comentar && session.id_ticket_redmine) {
        output += `ℹ Use --comentar=enviar o --comentar=encolar para notificar a Redmine.\n`
      }

      chatStore.messages.push({
        role: 'result',
        content: output.trim(),
        _key: 'merge-' + Date.now(),
      })
    } catch (err) {
      console.error('Error en /ambientes_merge:', err.message)
      throw err
    }
  },
})
