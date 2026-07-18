import { useWorkspaceStore } from '../stores/workspace.js'
import { useSettingsStore } from '../stores/settings.js'
import { useUiStore } from '../stores/ui.js'
import { useProjectStore } from '../stores/project.js'
import { useTicketStore } from '../stores/ticket.js'
import { useGitStore } from '../stores/git.js'
import { usePlaywrightLogsStore } from '../stores/playwrightLogs.js'
import { useEnvironmentsStore } from '../stores/environments.js'
import { useTemplatesStore } from '../stores/templates.js'
import { useServiciosStore } from '../stores/servicios.js'
import { useCommandStore } from '../stores/command.js'
import { useFileTreeStore } from '../stores/fileTree.js'
import { useBrowserStore } from '../stores/browser.js'
import { useDevInstanceStore } from '../stores/devInstance.js'
import { useOpencodeStore } from '../stores/opencode.js'
import { useRedmineCommentsStore } from '../stores/redmineComments.js'
import { useProjectVariablesStore } from '../stores/projectVariables.js'
import { useComandosPersonalizadosStore } from '../stores/comandosPersonalizados.js'
import { useTicketFormStore } from '../stores/ticketForm.js'
import { useAttachmentsStore } from '../stores/attachments.js'
import { useDocumentacionNotasStore } from '../stores/documentacionNotas.js'

export async function resetAllStores() {
  const stores = [
    useWorkspaceStore,
    useSettingsStore,
    useUiStore,
    useProjectStore,
    useTicketStore,
    useGitStore,
    usePlaywrightLogsStore,
    useEnvironmentsStore,
    useTemplatesStore,
    useServiciosStore,
    useCommandStore,
    useFileTreeStore,
    useBrowserStore,
    useDevInstanceStore,
    useOpencodeStore,
    useRedmineCommentsStore,
    useProjectVariablesStore,
    useComandosPersonalizadosStore,
    useTicketFormStore,
    useAttachmentsStore,
    useDocumentacionNotasStore,
  ]

  for (const useStore of stores) {
    try {
      const store = useStore()
      if (typeof store.reset === 'function') {
        store.reset()
      }
    } catch (err) {
      console.error(`Error reseteando store ${useStore.name}:`, err.message)
    }
  }
}
