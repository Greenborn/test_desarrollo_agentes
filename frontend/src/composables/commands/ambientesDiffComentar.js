import { useCommandRegistry } from '../useCommandRegistry.js'
import { parseCommandArgs, getUsedFlags } from '../parseCommandArgs.js'
import { useOpencodeStore } from '../../stores/opencode.js'

const { register } = useCommandRegistry()

register({
  name: '/ambientes_diff_comentar',
  category: 'Ambientes',
  description: 'Genera un comentario para el ticket Redmine con las diferencias entre dos ambientes. Con --tipo=commits lista los commits con su URL. Con --tipo=testing_notes usa un agente OpenCode para generar notas de testing.',
  usage: '/ambientes_diff_comentar --origen=<nombre> --destino=<nombre> [--tipo=<commits|testing_notes>]',
  async autocomplete(args, cmdStore) {
    const usedFlags = getUsedFlags(args)

    const origenArg = args.find(a => a.startsWith('--origen='))
    const destinoArg = args.find(a => a.startsWith('--destino='))
    const tipoArg = args.find(a => a.startsWith('--tipo='))

    if (tipoArg) {
      const val = tipoArg.slice('--tipo='.length)
      if (!val) {
        cmdStore.showAutocomplete(['--tipo=commits', '--tipo=testing_notes'])
        return
      }
      cmdStore.hideAutocomplete()
      return
    }

    if (origenArg) {
      const val = origenArg.slice('--origen='.length)
      if (!val && !usedFlags.includes('--destino') && !destinoArg) {
        cmdStore.showAutocomplete(['--origen=', '--destino=', '--tipo='])
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

    const remaining = ['--destino=', '--tipo='].filter(f => !usedFlags.includes(f) && !args.find(a => a.startsWith(f)))
    if (remaining.length > 0) {
      cmdStore.showAutocomplete(remaining)
    } else {
      cmdStore.hideAutocomplete()
    }
  },
  async execute(args, { chatStore, cmdStore, sessionId }) {
    if (!sessionId) {
      throw new Error('Primero debe iniciar una sesión de chat.')
    }

    const session = chatStore.sessions.find(s => s.id === sessionId)
    if (!session || !session.cwd) {
      throw new Error('La sesión no tiene un directorio de trabajo definido. Use /cd para establecerlo.')
    }

    const idTicket = session.id_ticket_redmine
    if (!idTicket) {
      throw new Error('No hay ticket Redmine asociado a la sesión. Use /chat_set_ticket para asignar uno.')
    }

    const { params, errors } = parseCommandArgs(args, {
      origen: { required: true },
      destino: { required: true },
      tipo: { required: false },
    })
    if (errors.length > 0) {
      throw new Error(errors.join('. '))
    }

    const tipo = params.tipo || 'commits'
    if (!['commits', 'testing_notes'].includes(tipo)) {
      throw new Error('--tipo debe ser "commits" o "testing_notes"')
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

      if (tipo === 'testing_notes') {
        const ocStore = useOpencodeStore()

        if (ocStore.ocSessionId) {
          try {
            await fetch('/api/opencode/finish', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              credentials: 'include',
              body: JSON.stringify({ ocSessionId: ocStore.ocSessionId, directory: cmdStore.currentDir || undefined }),
            })
          } catch (err) {
            console.error('Error al cerrar sesión OpenCode previa:', err)
          }
          ocStore.finish()
        }

        const startData = await ocStore.start()
        if (!startData) return

        const providerList = ocStore.getAvailableProviders()
        if (providerList.length === 0) {
          console.error('Error: no se encontraron proveedores')
          return
        }

        const preselectProvider = ocStore.savedProvider || providerList[0].value

        chatStore.pushMessage({
          role: 'opencode_control',
          controlData: {
            controlId: 'tn-provider-' + Date.now(),
            controlType: 'select',
            stepType: 'ambientes_diff_testing_setup',
            subStepType: 'provider',
            options: providerList,
            placeholder: 'Selecciona proveedor...',
            preselect: preselectProvider,
            origen: params.origen,
            destino: params.destino,
            diffData: data,
          },
          _key: 'control-' + Date.now(),
        }, sessionId)
        return
      }

      let commentBody

      if (!data.commits || data.commits.length === 0) {
        commentBody = `Sin diferencias entre ${data.sourceEnv} (${data.sourceBranch}) y ${data.targetEnv} (${data.targetBranch}).`
      } else {
        const lines = data.commits.map(c => {
          const url = c.githubUrl || `${data.remoteUrl}/commit/${c.hash}`
          return `- ${c.message}: ${url}`
        })

        commentBody = lines.join('\n')
      }

      chatStore.pushMessage({
        role: 'opencode_control',
        controlData: {
          controlId: 'ambientes-diff-comment-' + Date.now(),
          controlType: 'ambientes_diff_comment',
          message: commentBody,
          sourceEnv: data.sourceEnv,
          targetEnv: data.targetEnv,
          modo_envio: 'encolar',
        },
        _key: 'control-' + Date.now(),
      }, sessionId)
    } catch (err) {
      console.error('Error en /ambientes_diff_comentar:', err.message)
      chatStore.pushMessage({
        role: 'result',
        content: `Error: ${err.message}`,
        _key: 'diff-err-' + Date.now(),
      }, sessionId)
    }
  },
})
