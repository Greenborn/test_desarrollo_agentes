import { useCommandRegistry } from '../useCommandRegistry.js'
import { parseCommandArgs } from '../parseCommandArgs.js'

const { register } = useCommandRegistry()

register({
  name: '/dev_git_crear_rama',
  category: 'Desarrollo',
  description: 'Crea una rama Git a partir del proyecto y ticket de la sesión, usando una rama base seleccionable. Requiere que el directorio de trabajo sea un repositorio Git.',
  usage: '/dev_git_crear_rama [--base=<rama_base>]',
  async execute(args, { chatStore, sessionId }) {
    if (!sessionId) {
      throw new Error('Primero debe iniciar una sesión de chat.')
    }

    const session = chatStore.sessions.find(s => s.id === sessionId)
    if (!session) {
      throw new Error('No se encontró la sesión de chat.')
    }

    const { params } = parseCommandArgs(args)
    const baseBranch = params.base || null

    const verifyRes = await fetch('/api/command/git-verify', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      credentials: 'include',
      body: JSON.stringify({ sessionId }),
    })
    const verifyData = await verifyRes.json()
    if (!verifyData.isRepo) {
      throw new Error(verifyData.error || 'El directorio de la sesión no es un repositorio Git.')
    }

    const settingsRes = await fetch('/api/settings', { credentials: 'include' })
    const settingsData = await settingsRes.json()
    const repoAcronimo = settingsData.repo_acronimo || 'TKT'

    if (!session.proyecto_id) {
      const projRes = await fetch('/api/proyecto', { credentials: 'include' })
      const projData = await projRes.json()
      const options = (projData.proyectos || []).map(p => ({
        label: `${p.id} — ${p.descripcion || ''}`,
        value: p.id,
      }))
      return {
        role: 'opencode_control',
        controlData: {
          controlId: 'repo-project-' + Date.now(),
          controlType: 'select',
          stepType: 'repo_crear_rama',
          subStepType: 'project',
          options,
          placeholder: 'Selecciona proyecto...',
          sessionId,
          repoAcronimo,
          baseBranch,
        },
      }
    }

    if (!session.id_ticket_redmine) {
      const ticketRes = await fetch('/api/tickets', { credentials: 'include' })
      const ticketData = await ticketRes.json()
      let tickets = ticketData.tickets || []
      if (session.proyecto_id) {
        tickets = tickets.filter(t => t.proyecto_id === session.proyecto_id)
      }
      const options = tickets.map(t => ({
        label: `#${t.redmine_id} — ${t.subject || ''}`,
        value: String(t.redmine_id),
      }))
      return {
        role: 'opencode_control',
        controlData: {
          controlId: 'repo-ticket-' + Date.now(),
          controlType: 'select',
          stepType: 'repo_crear_rama',
          subStepType: 'ticket',
          options,
          placeholder: 'Selecciona ticket...',
          proyectoId: session.proyecto_id,
          sessionId,
          repoAcronimo,
          baseBranch,
        },
      }
    }

    if (baseBranch) {
      const checkoutRes = await fetch('/api/command/git', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ command: 'checkout ' + baseBranch, sessionId }),
      })
      const checkoutData = await checkoutRes.json()
      if (!checkoutData.success) {
        throw new Error('Error al cambiar a rama base "' + baseBranch + '": ' + (checkoutData.stderr || checkoutData.error || 'Error desconocido'))
      }

      const branchName = repoAcronimo + '-' + session.id_ticket_redmine
      const branchRes = await fetch('/api/command/git', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ command: 'checkout -b ' + branchName, sessionId }),
      })
      const branchData = await branchRes.json()
      if (!branchData.success) {
        throw new Error('Error al crear rama "' + branchName + '": ' + (branchData.stderr || branchData.error || 'Error desconocido'))
      }

      return {
        role: 'result',
        content: '✓ Rama creada correctamente: `' + branchName + '` (base: `' + baseBranch + '`)',
      }
    }

    const branchRes = await fetch('/api/command/git-list-branches', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      credentials: 'include',
      body: JSON.stringify({ sessionId }),
    })
    const branchData = await branchRes.json()
    const branchOptions = (branchData.branches || []).map(b => ({ label: b, value: b }))
    const preselect = branchData.current && branchData.branches.includes(branchData.current) ? branchData.current : 'DEV'

    return {
      role: 'opencode_control',
      controlData: {
        controlId: 'repo-branch-' + Date.now(),
        controlType: 'select',
        stepType: 'repo_crear_rama',
        subStepType: 'branch',
        options: branchOptions,
        placeholder: 'Selecciona rama base...',
        preselect,
        proyectoId: session.proyecto_id,
        ticketRedmineId: session.id_ticket_redmine,
        sessionId,
        repoAcronimo,
        baseBranch,
      },
    }
  },
})
