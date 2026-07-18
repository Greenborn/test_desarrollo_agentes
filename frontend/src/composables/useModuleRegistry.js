import { shallowReactive } from 'vue'
import { useCommandRegistry } from './useCommandRegistry.js'

const modules = shallowReactive([])
const sidebarRightTabs = shallowReactive([])
const sidebarChatTabs = shallowReactive([])
const devPanelTabs = shallowReactive([])

export function useModuleRegistry() {
  function registerModule(mod) {
    const existing = modules.findIndex((m) => m.id === mod.id)
    if (existing >= 0) {
      modules[existing] = mod
    } else {
      modules.push(mod)
    }

    const validateTab = (tab, slot) => {
      if (!tab.id || !tab.label || typeof tab.priority !== 'number') {
        console.error(`[Module ${mod.id}] Tab "${tab.id || '(unnamed)'}" in ${slot} requires id, label, and numeric priority — skipped`)
        return false
      }
      return true
    }

    if (mod.tabs?.sidebarRight) {
      for (const tab of mod.tabs.sidebarRight) {
        if (!validateTab(tab, 'sidebarRight')) continue
        if (!sidebarRightTabs.find((t) => t.id === tab.id)) {
          sidebarRightTabs.push(tab)
        }
      }
    }
    if (mod.tabs?.sidebarChat) {
      for (const tab of mod.tabs.sidebarChat) {
        if (!validateTab(tab, 'sidebarChat')) continue
        if (!sidebarChatTabs.find((t) => t.id === tab.id)) {
          sidebarChatTabs.push(tab)
        }
      }
    }
    if (mod.tabs?.devPanel) {
      for (const tab of mod.tabs.devPanel) {
        if (!validateTab(tab, 'devPanel')) continue
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
