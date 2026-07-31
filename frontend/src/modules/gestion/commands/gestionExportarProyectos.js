import { parseCommandArgs, getUsedFlags } from '../../../composables/parseCommandArgs.js'
import { useModalStore } from '../../../stores/modal.js'
import { useWorkspaceStore } from '../../../stores/workspace.js'
import GestionSyncModal from '../../../components/modals/GestionSyncModal.vue'

export default {
  name: '/gestion_exportar_proyectos',
  category: 'Gestión',
  description: 'Exporta proyectos locales al sistema de gestión interno. Abre un modal con switches para seleccionar cuáles exportar. Los ya presentes en gestión se muestran deshabilitados.',
  usage: '/gestion_exportar_proyectos [--workspace_id=<id>]',
  autocomplete(args, cmdStore) {
    const usedFlags = getUsedFlags(args)
    const allFlags = ['--workspace_id=']
    const suggestions = allFlags.filter(f => !usedFlags.includes(f))
    if (suggestions.length > 0) {
      cmdStore.showAutocomplete(suggestions)
    } else {
      cmdStore.hideAutocomplete()
    }
  },
  async execute(args, { chatStore, loadingIdx }) {
    const { params, errors } = parseCommandArgs(args, {
      workspace_id: { required: false, type: 'number' },
    })
    if (errors.length) return errors.join('\n')

    if (chatStore.messages[loadingIdx]) {
      chatStore.messages[loadingIdx] = { ...chatStore.messages[loadingIdx], content: 'Consultando proyectos locales y del sistema de gestión interna...' }
    }

    const wsStore = useWorkspaceStore()
    const workspaceId = params.workspace_id || wsStore.getPrimaryWorkspaceId()
    const wsParam = workspaceId ? `?workspace_id=${workspaceId}` : ''

    const localRes = await fetch('/api/proyecto', { credentials: 'include' })
    const localData = await localRes.json()
    const proyectos = (localData.proyectos || []).filter((p) => {
      if (!wsParam) return true
      return Number(p.workspace_id) === Number(workspaceId)
    })

    if (proyectos.length === 0) {
      return 'No se encontraron proyectos locales para exportar.'
    }

    const gestRes = await fetch(`/api/gestion/proyectos${wsParam}`, { credentials: 'include' })
    const gestData = await gestRes.json()

    if (!gestData.success) {
      throw new Error(gestData.message || 'Error al consultar el sistema de gestión interna.')
    }

    const importedSlugs = (gestData.proyectos || []).map((p) => p.slug)

    const modal = useModalStore()
    modal.open(GestionSyncModal, {
      proyectos,
      importedSlugs,
      workspaceId: workspaceId || 0,
    }, {
      title: 'Exportar Proyectos a Gestión',
      wide: true,
    })

    return 'Seleccione los proyectos locales a exportar en el modal. Los ya exportados al sistema de gestión se muestran deshabilitados.'
  },
}
