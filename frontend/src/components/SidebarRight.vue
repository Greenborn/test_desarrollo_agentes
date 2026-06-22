<template>
  <div
    class="sidebar-right d-flex flex-column h-100 bg-dark"
    :class="{ collapsed: rightPanelCollapsed, transitioning: rightPanelTransitioning }"
    :style="rightPanelCollapsed ? {} : { width: rightPanelWidth + 'px', minWidth: rightPanelWidth + 'px' }"
  >
    <div class="tab-bar d-flex align-items-center px-3 pt-0 pb-1 flex-shrink-0">
      <span class="panel-title">Panel derecho</span>
    </div>
    <div class="d-flex flex-column align-items-center justify-content-center flex-grow-1 text-secondary small">
      <span>Próximamente</span>
    </div>
    <div class="sidebar-right-resize-handle" @mousedown.prevent="onResizeStart">
      <div class="sidebar-right-resize-handle-bar"></div>
    </div>
  </div>
</template>

<script>
import { watch, ref } from 'vue'
import { storeToRefs } from 'pinia'
import { useUiStore } from '../stores/ui.js'

export default {
  setup() {
    const ui = useUiStore()
    const { rightPanelCollapsed, rightPanelWidth } = storeToRefs(ui)

    const rightPanelTransitioning = ref(false)
    let transitionTimer = null

    function onResizeStart(e) {
      rightPanelTransitioning.value = false

      function onMouseMove(e) {
        rightPanelWidth.value = Math.max(window.innerWidth * 0.05, Math.min(600, window.innerWidth - e.clientX))
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

    watch(rightPanelCollapsed, () => {
      if (transitionTimer) clearTimeout(transitionTimer)
      rightPanelTransitioning.value = true
      transitionTimer = setTimeout(() => {
        rightPanelTransitioning.value = false
        transitionTimer = null
      }, 300)
    })

    return {
      rightPanelCollapsed,
      rightPanelWidth,
      rightPanelTransitioning,
      onResizeStart,
    }
  },
}
</script>

<style scoped>
.tab-bar {
  border-bottom: 1px solid #374151;
}
.panel-title {
  color: #6b7280;
  font-size: 0.75rem;
  padding: 4px 10px;
}
.sidebar-right {
  position: relative;
  padding: 8px;
  border-left: 1px solid #374151;
}
.sidebar-right.transitioning {
  transition: width 0.25s ease, min-width 0.25s ease, padding 0.25s ease, border 0.25s ease;
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
