<template>
  <div>
    <div v-if="activeModals.length > 0" class="app-modal-backdrop"></div>

    <div
      v-for="modal in activeModals"
      :key="modal.id"
      class="modal-window"
      :class="{ 'modal-wide': modal.wide }"
      :style="getWindowStyle(modal)"
      @mousedown="bringToFront(modal.id)"
    >
      <div
        class="modal-window-header"
        @mousedown.prevent="onDragStart($event, modal)"
      >
        <span class="modal-window-title">{{ modal.title }}</span>
        <div class="modal-window-controls">
          <button class="modal-btn-minimize" @click.stop="toggleMinimize(modal.id)" title="Minimizar">─</button>
          <button class="modal-btn-close" @click.stop="close(modal.id)" title="Cerrar">✕</button>
        </div>
      </div>
      <div class="modal-window-body">
        <component :is="modal.component" v-bind="modal.props" @close="close(modal.id)" />
      </div>
    </div>

    <div
      v-if="minimizedModals.length > 0"
      class="modal-taskbar"
      :class="{ visible: showTaskbar }"
      @mouseenter="onTaskbarEnter"
      @mouseleave="onTaskbarLeave"
    >
      <div class="modal-taskbar-inner">
        <div
          v-for="modal in minimizedModals"
          :key="modal.id"
          class="modal-taskbar-item"
          @click="toggleMinimize(modal.id)"
          :title="modal.title"
        >
          <span class="modal-taskbar-title">{{ modal.title }}</span>
        </div>
      </div>
    </div>
  </div>
</template>

<script>
import { ref, computed, watch, onMounted, onUnmounted } from 'vue'
import { storeToRefs } from 'pinia'
import { useModalStore } from '../../stores/modal.js'

export default {
  setup() {
    const modal = useModalStore()
    const { stack } = storeToRefs(modal)

    const BOTTOM_THRESHOLD = 12
    const activeModals = computed(() => stack.value.filter(m => !m.minimized))
    const minimizedModals = computed(() => stack.value.filter(m => m.minimized))
    const showTaskbar = ref(false)
    let hideTaskbarTimer = null

    function onGlobalMouseMove(e) {
      const nearBottom = window.innerHeight - e.clientY < BOTTOM_THRESHOLD
      if (nearBottom && minimizedModals.value.length > 0) {
        if (hideTaskbarTimer) {
          clearTimeout(hideTaskbarTimer)
          hideTaskbarTimer = null
        }
        showTaskbar.value = true
      }
    }

    function onTaskbarEnter() {
      if (hideTaskbarTimer) {
        clearTimeout(hideTaskbarTimer)
        hideTaskbarTimer = null
      }
      showTaskbar.value = true
    }

    function onTaskbarLeave() {
      if (hideTaskbarTimer) clearTimeout(hideTaskbarTimer)
      hideTaskbarTimer = setTimeout(() => {
        showTaskbar.value = false
        hideTaskbarTimer = null
      }, 300)
    }

    onMounted(() => {
      document.addEventListener('mousemove', onGlobalMouseMove)
    })

    onUnmounted(() => {
      document.removeEventListener('mousemove', onGlobalMouseMove)
      if (hideTaskbarTimer) clearTimeout(hideTaskbarTimer)
    })

    watch(activeModals, (val) => {
      document.body.style.overflow = val.length > 0 ? 'hidden' : ''
    }, { immediate: true })

    function getWindowStyle(m) {
      const s = {
        left: m.position.x + 'px',
        top: m.position.y + 'px',
        zIndex: m.zIndex,
      }
      if (m.size && m.size.width) {
        s.width = m.size.width + 'px'
      }
      if (m.size && m.size.height && m.wide) {
        s.height = m.size.height + 'px'
      }
      return s
    }

    function close(id) {
      modal.close(id)
    }

    function toggleMinimize(id) {
      modal.toggleMinimize(id)
    }

    function bringToFront(id) {
      modal.bringToFront(id)
    }

    function onDragStart(e, m) {
      const el = e.currentTarget.parentElement
      const rect = el.getBoundingClientRect()
      const offsetX = e.clientX - rect.left
      const offsetY = e.clientY - rect.top

      function onDragMove(e) {
        const x = Math.max(0, e.clientX - offsetX)
        const y = Math.max(0, e.clientY - offsetY)
        modal.updatePosition(m.id, x, y)
      }

      function onDragEnd() {
        document.removeEventListener('mousemove', onDragMove)
        document.removeEventListener('mouseup', onDragEnd)
        document.body.style.cursor = ''
        document.body.style.userSelect = ''
      }

      document.addEventListener('mousemove', onDragMove)
      document.addEventListener('mouseup', onDragEnd)
      document.body.style.cursor = 'grabbing'
      document.body.style.userSelect = 'none'
    }

    return { stack, activeModals, minimizedModals, showTaskbar, getWindowStyle, close, toggleMinimize, bringToFront, onDragStart, onTaskbarEnter, onTaskbarLeave }
  },
}
</script>

<style>
.app-modal-backdrop {
  position: fixed;
  inset: 0;
  background: rgba(0, 0, 0, 0.5);
  z-index: 1040;
}

.modal-window {
  position: fixed;
  display: flex;
  flex-direction: column;
  background: #212529;
  border: 1px solid #495057;
  border-radius: 8px;
  box-shadow: 0 8px 32px rgba(0, 0, 0, 0.5);
  min-width: 360px;
  max-width: 800px;
  max-height: 85vh;
  overflow: hidden;
}

.modal-window.modal-wide {
  max-width: none;
  max-height: none;
}

.modal-window-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 8px 12px;
  border-bottom: 1px solid #495057;
  cursor: grab;
  user-select: none;
  flex-shrink: 0;
}

.modal-window-header:active {
  cursor: grabbing;
}

.modal-window-title {
  margin: 0;
  font-size: 0.85rem;
  color: #f8f9fa;
  font-family: monospace;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
  flex: 1;
  min-width: 0;
}

.modal-window-controls {
  display: flex;
  align-items: center;
  gap: 4px;
  flex-shrink: 0;
  margin-left: 12px;
}

.modal-btn-minimize,
.modal-btn-close {
  background: none;
  border: none;
  color: #9ca3af;
  font-size: 0.85rem;
  line-height: 1;
  padding: 2px 8px;
  cursor: pointer;
  border-radius: 3px;
  transition: background 0.15s, color 0.15s;
  font-family: monospace;
}

.modal-btn-minimize:hover {
  background: #374151;
  color: #f8f9fa;
}

.modal-btn-close:hover {
  background: #dc3545;
  color: #fff;
}

.modal-window-body {
  flex: 1;
  overflow-y: auto;
  padding: 16px;
  color: #e0e0e0;
  min-height: 0;
}

.modal-wide .modal-window-body {
  display: flex;
  flex-direction: column;
  overflow: hidden;
}

.modal-taskbar {
  position: fixed;
  bottom: 0;
  left: 0;
  right: 0;
  height: 36px;
  z-index: 2000;
  background: #16162a;
  border-top: 1px solid #374151;
  display: flex;
  align-items: center;
  padding: 0 8px;
  transform: translateY(100%);
  transition: transform 0.2s ease;
}

.modal-taskbar.visible {
  transform: translateY(0);
}

.modal-taskbar-inner {
  display: flex;
  align-items: center;
  gap: 4px;
  overflow-x: auto;
  height: 100%;
  width: 100%;
}

.modal-taskbar-item {
  display: flex;
  align-items: center;
  padding: 4px 12px;
  background: #1e1e3a;
  border: 1px solid #374151;
  border-radius: 4px;
  cursor: pointer;
  transition: background 0.15s;
  white-space: nowrap;
  flex-shrink: 0;
  max-width: 200px;
  height: 28px;
}

.modal-taskbar-item:hover {
  background: #2a2a4a;
}

.modal-taskbar-title {
  font-size: 0.75rem;
  color: #cbd5e1;
  font-family: monospace;
  overflow: hidden;
  text-overflow: ellipsis;
}
</style>
