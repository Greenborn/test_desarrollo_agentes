<template>
  <div
    class="sidebar-right d-flex flex-column h-100 bg-dark"
    :class="{ collapsed: rightPanelCollapsed }"
    :style="sidebarStyle"
  >
    <div class="tab-bar d-flex align-items-center px-3 pt-0 pb-1 flex-shrink-0">
      <button v-for="t in moduleTabs" :key="t.id" class="tab-btn" :class="{ active: tab === t.id }" @click="selectTab(t.id)">{{ t.label }}</button>
    </div>

    <template v-for="t in moduleTabs" :key="t.id">
      <component :is="t.component" v-if="tab === t.id" />
    </template>
    <div class="sidebar-right-resize-handle" @mousedown.prevent="onResizeStart">
      <div class="sidebar-right-resize-handle-bar"></div>
    </div>
  </div>
</template>

<script>
import { watch, ref, computed } from 'vue'
import { storeToRefs } from 'pinia'
import { useUiStore } from '../../stores/ui.js'
import { useChatStore } from '../../stores/chat.js'
import { useDocumentacionNotasStore } from '../../stores/documentacionNotas.js'
import { useModuleRegistry } from '../../composables/useModuleRegistry.js'
export default {
  setup() {
    const ui = useUiStore()
    const chat = useChatStore()
    const docNotasStore = useDocumentacionNotasStore()
    const { rightPanelCollapsed, rightPanelWidth, centralPanelCollapsed, sidebarWidthPct, sidebarCollapsed, sidebarRightTab } = storeToRefs(ui)
    const { activeSessionId, sessions } = storeToRefs(chat)
    const { sidebarRightTabs } = useModuleRegistry()
    const moduleTabs = computed(() => {
      if (!sidebarRightTabs) return []
      return [...sidebarRightTabs].sort((a, b) => (a.priority || 50) - (b.priority || 50))
    })
    const tab = ref('comentarios')
    const stopTabSync = watch(sidebarRightTab, (v) => { tab.value = v; stopTabSync() })

    const activeSession = computed(() => {
      return sessions.value.find(s => s.id === activeSessionId.value) || null
    })

    const proyectoId = computed(() => activeSession.value?.proyecto_id || null)

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

    function selectTab(val) {
      tab.value = val
      sidebarRightTab.value = val
      ui.saveLayoutPrefs()
    }

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

    watch(proyectoId, (newId) => {
      if (!newId) {
        docNotasStore.clearNotas()
        return
      }
      docNotasStore.loadNotas(newId)
    })

    return {
      rightPanelCollapsed,
      rightPanelWidth,
      sidebarStyle,
      tab,
      selectTab,
      activeSessionId,
      moduleTabs,
      onResizeStart,
    }
  },
}
</script>

<style scoped>
.tab-bar {
  border-bottom: 1px solid #374151;
  overflow: hidden;
  white-space: nowrap;
}
.tab-btn {
  background: none;
  border: none;
  color: #6b7280;
  font-size: 0.75rem;
  padding: 4px 10px;
  cursor: pointer;
  border-bottom: 2px solid transparent;
  margin-bottom: -1px;
  transition: color 0.15s, border-color 0.15s;
}
.tab-btn:hover {
  color: #cbd5e1;
}
.tab-btn.active {
  color: #75AADB;
  border-bottom-color: #75AADB;
}
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
