import { useCommandRegistry } from '../useCommandRegistry.js'

const { register } = useCommandRegistry()

register({
  name: '/dev_git_ir_rama_ticket',
  category: 'Desarrollo',
  description: 'Cambia a la rama Git asociada al ticket de la sesión actual. Valida que no haya cambios sin comitear, que la sesión tenga ticket asignado y que la rama exista.',
  usage: '/dev_git_ir_rama_ticket',
  async execute(args, { chatStore }) {
    const sessionId = chatStore.activeSessionId
    if (!sessionId) {
      throw new Error('Primero debe iniciar una sesión de chat.')
    }

    const session = chatStore.sessions.find(s => s.id === sessionId)
    if (!session) {
      throw new Error('No se encontró la sesión de chat.')
    }

    if (!session.id_ticket_redmine) {
      throw new Error('La sesión no tiene un ticket de Redmine asignado. Use /chat_set_ticket --id=<id> para asignar uno.')
    }

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

    const statusRes = await fetch('/api/command/git', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      credentials: 'include',
      body: JSON.stringify({ command: 'status --porcelain', sessionId }),
    })
    const statusData = await statusRes.json()
    if (!statusData.success) {
      throw new Error('Error al verificar el estado de Git: ' + (statusData.stderr || statusData.error))
    }
    if (statusData.stdout && statusData.stdout.trim()) {
      throw new Error('Hay cambios sin comitear. Confirme o descarte los cambios antes de continuar.')
    }

    const settingsRes = await fetch('/api/settings', { credentials: 'include' })
    const settingsData = await settingsRes.json()
    const repoAcronimo = settingsData.repo_acronimo || 'TKT'

    const branchName = repoAcronimo + '-' + session.id_ticket_redmine

    const branchesRes = await fetch('/api/command/git-list-branches', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      credentials: 'include',
      body: JSON.stringify({ sessionId }),
    })
    const branchesData = await branchesRes.json()
    const branches = (branchesData.branches || []).map(b => b.trim())
    if (!branches.includes(branchName)) {
      throw new Error(`La rama "${branchName}" no existe localmente. Cree la rama con /dev_git_crear_rama o verifique el nombre.`)
    }

    const checkoutRes = await fetch('/api/command/git', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      credentials: 'include',
      body: JSON.stringify({ command: 'checkout ' + branchName, sessionId }),
    })
    const checkoutData = await checkoutRes.json()
    if (!checkoutData.success) {
      throw new Error('Error al cambiar a la rama "' + branchName + '": ' + (checkoutData.stderr || checkoutData.error || 'Error desconocido'))
    }

    return 'Cambiado a la rama `' + branchName + '` correctamente.'
  },
})
