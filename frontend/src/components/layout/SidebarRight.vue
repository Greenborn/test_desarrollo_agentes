<template>
  <div
    class="sidebar-right d-flex flex-column h-100 bg-dark"
    :class="{ collapsed: rightPanelCollapsed }"
    :style="sidebarStyle"
  >
    <TabPanel
      class="flex-grow-1"
      style="min-height: 0;"
      :tabs="ctl.localTabs.value"
      :active="ctl.activeTab.value"
      keep-alive
      :keep-alive-max="6"
      :keep-alive-exclude="['InterfazRemotaTab', 'SkillsTab']"
      @select="onSelect"
      @reorder="ctl.reorder"
    />
    <div class="sidebar-right-resize-handle" @mousedown.prevent="onResizeStart">
      <div class="sidebar-right-resize-handle-bar"></div>
    </div>
  </div>
</template>

<script>
import { watch, ref, computed } from 'vue'
import { storeToRefs } from 'pinia'
import { TabPanel, useTabController } from 'vue-greenborn-panels'
import { useUiStore } from '../../stores/ui.js'
import { useChatStore } from '../../stores/chat.js'
import { useActiveComponentsStore } from '../../stores/activeComponents.js'
import { useModuleRegistry } from '../../composables/useModuleRegistry.js'

export default {
  components: { TabPanel },
  setup() {
    const ui = useUiStore()
    const chat = useChatStore()
    const ac = useActiveComponentsStore()
    const { rightPanelCollapsed, rightPanelWidth, centralPanelCollapsed, sidebarWidthPct, sidebarCollapsed, sidebarRightTabOrder } = storeToRefs(ui)
    const { activeSessionId, sessions } = storeToRefs(chat)
    const { sidebarRightTabs } = useModuleRegistry()

    function saveTabOrder(ids) {
      sidebarRightTabOrder.value = ids
      ui.saveLayoutPrefs()
    }

    function restoreTab() {
      const prefs = chat.getSessionPrefs(chat.activeSessionId)
      return prefs?.sidebarRightTab || 'comentarios'
    }

    const ctl = useTabController({
      slotTabs: sidebarRightTabs,
      builtinTabs: [],
      savedOrder: sidebarRightTabOrder,
      filterTab: (t) => ac.isActive('sidebarRight', t.id),
      watchFilter: [() => ac.activeConfig],
      persistOrder: saveTabOrder,
      initialTab: 'comentarios',
      restoreTab,
    })

    function onSelect(id) {
      ctl.select(id)
      if (chat.activeSessionId) chat.saveSessionPref(chat.activeSessionId, 'sidebarRightTab', id)
    }

    watch(() => chat.activeSessionId, () => {
      ctl.activeTab.value = restoreTab()
    })

    const activeSession = computed(() => {
      return sessions.value.find(s => s.id === activeSessionId.value) || null
    })

    const proyectoId = computed(() => activeSession.value?.proyecto_id || null)

    watch(proyectoId, (newId) => {
      if (newId) onSelect('variables')
    })

    const sidebarStyle = computed(() => {
      if (rightPanelCollapsed.value) return {}
      if (centralPanelCollapsed.value) {
        if (sidebarCollapsed.value) {
          return { flex: '1 1 100%', minWidth: '5vw' }
        }
        const rightPct = 100 - sidebarWidthPct.value
        return { flex: `0 0 ${rightPct}%`, minWidth: '5vw' }
      }
      return { width: rightPanelWidth.value + 'px', minWidth: rightPanelWidth.value + 'px' }
    })

    function onResizeStart(e) {
      const resizeHandle = e.currentTarget

      function onMouseMove(e) {
        if (ui.centralPanelCollapsed) {
          const container = resizeHandle.closest('.sidebar-right')?.parentElement
          const containerWidth = container ? container.getBoundingClientRect().width : window.innerWidth
          const rightPct = ((containerWidth - e.clientX) / containerWidth) * 100
          ui.setSidebarWidthPct(100 - Math.max(5, Math.min(95, rightPct)))
        } else {
          const leftWidth = ui.sidebarCollapsed ? 0 : ui.sidebarWidth
          const maxAllowed = Math.max(window.innerWidth * 0.05, window.innerWidth - leftWidth - window.innerWidth * 0.05)
          rightPanelWidth.value = Math.max(window.innerWidth * 0.05, Math.min(maxAllowed, window.innerWidth - e.clientX))
        }
      }

      function onMouseUp() {
        document.removeEventListener('mousemove', onMouseMove)
        document.removeEventListener('mouseup', onMouseUp)
        document.body.style.cursor = ''
        document.body.style.userSelect = ''
        ui.saveLayoutPrefs()
      }

      document.addEventListener('mousemove', onMouseMove)
      document.addEventListener('mouseup', onMouseUp)
      document.body.style.cursor = 'col-resize'
      document.body.style.userSelect = 'none'
    }

    return {
      rightPanelCollapsed,
      sidebarStyle,
      ctl,
      onSelect,
      onResizeStart,
    }
  },
}
</script>

<style scoped>
.sidebar-right {
  position: relative;
  padding: 8px;
  border-left: 1px solid #374151;
  background: #1a1a2e;
}
.sidebar-right.collapsed {
  width: 0 !important;
  min-width: 0 !important;
  padding: 0;
  border: none;
  overflow: hidden;
}
.sidebar-right-resize-handle {
  position: absolute;
  top: 0;
  left: -6px;
  width: 12px;
  height: 100%;
  cursor: col-resize;
  z-index: 10;
  display: flex;
  align-items: center;
  justify-content: center;
}
.sidebar-right-resize-handle:hover {
  background: rgba(117, 170, 219, 0.08);
}
.sidebar-right-resize-handle-bar {
  width: 3px;
  height: 36px;
  background: #374151;
  border-radius: 2px;
  pointer-events: none;
  transition: background 0.15s;
}
.sidebar-right-resize-handle:hover .sidebar-right-resize-handle-bar {
  background: #75AADB;
}
</style>
