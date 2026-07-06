import { reactive } from 'vue'
import { useCommandRegistry } from './useCommandRegistry.js'

const modules = reactive([])
const sidebarRightTabs = reactive([])
const sidebarChatTabs = reactive([])
const devPanelTabs = reactive([])

export function useModuleRegistry() {
  function registerModule(mod) {
    const existing = modules.findIndex((m) => m.id === mod.id)
    if (existing >= 0) {
      modules[existing] = mod
    } else {
      modules.push(mod)
    }

    if (mod.tabs?.sidebarRight) {
      for (const tab of mod.tabs.sidebarRight) {
        if (!sidebarRightTabs.find((t) => t.id === tab.id)) {
          sidebarRightTabs.push(tab)
        }
      }
    }
    if (mod.tabs?.sidebarChat) {
      for (const tab of mod.tabs.sidebarChat) {
        if (!sidebarChatTabs.find((t) => t.id === tab.id)) {
          sidebarChatTabs.push(tab)
        }
      }
    }
    if (mod.tabs?.devPanel) {
      for (const tab of mod.tabs.devPanel) {
        if (!devPanelTabs.find((t) => t.id === tab.id)) {
          devPanelTabs.push(tab)
        }
      }
    }

    if (mod.commands) {
      const { register } = useCommandRegistry()
      for (const cmd of mod.commands) {
        register(cmd)
      }
    }

    if (typeof mod.init === 'function') {
      mod.init()
    }
  }

  return {
    modules,
    sidebarRightTabs,
    sidebarChatTabs,
    devPanelTabs,
    registerModule,
  }
}
