<template>
  <div
    class="sidebar-chat d-flex flex-column h-100 bg-dark"
    :class="{ collapsed: sidebarCollapsed, transitioning: sidebarTransitioning }"
    :style="sidebarCollapsed ? {} : { width: sidebarWidth + 'px', minWidth: sidebarWidth + 'px' }"
  >
    <button class="btn btn-sm mb-2 flex-shrink-0 btn-argentina" @click="createSession" :disabled="creating">
      {{ creating ? 'Creando...' : '＋ Nuevo chat' }}
    </button>
    <div class="overflow-y-auto flex-grow-1" style="min-height: 0;">
      <div class="list-group list-group-flush" style="min-height: 0;">
        <button
          v-for="s in filteredSessions"
          :key="s.id"
          class="list-group-item list-group-item-action py-2 px-2 small d-flex justify-content-between align-items-center"
          :class="[{ active: s.id === activeSessionId }, ticketPriorityClass(s.priority_id)]"
          :title="sessionTooltip(s)"
          @click="selectSession(s.id)"
        >
          <span class="status-led" :class="getSessionStatus(s.id)"></span>
          <span v-if="s.id_ticket_redmine" class="ticket-badge">#{{ s.id_ticket_redmine }}</span>
          <span class="text-truncate">{{ s.title }}</span>
          <span
            class="delete-btn"
            @click.stop="chat.deleteSession(s.id)"
            title="Eliminar conversación"
          >&times;</span>
        </button>
      </div>
    </div>
    <div class="sidebar-resize-handle" @mousedown.prevent="onResizeStart">
      <div class="sidebar-resize-handle-bar"></div>
    </div>
  </div>
</template>

<script>
import { computed, watch, ref } from 'vue'
import { storeToRefs } from 'pinia'
import { useChatStore } from '../stores/chat.js'
import { useCommandStore } from '../stores/command.js'
import { useUiStore } from '../stores/ui.js'

export default {
  setup() {
    const chat = useChatStore()
    const cmd = useCommandStore()
    const ui = useUiStore()
    const { sessions, activeSessionId, creating, sessionStatus } = storeToRefs(chat)
    const { sidebarCollapsed, sidebarWidth, omnifilter } = storeToRefs(ui)

    const sidebarTransitioning = ref(false)
    let transitionTimer = null

    const filteredSessions = computed(() => {
      const filter = omnifilter.value.toLowerCase()
      if (!filter) return sessions.value
      return sessions.value.filter((s) => {
        const fields = [s.title, s.proyecto_descripcion, s.proyecto_id, s.cwd]
        return fields.some((f) => f && f.toLowerCase().includes(filter))
      })
    })

    function sessionTooltip(s) {
      const lines = []
      if (s.proyecto_descripcion) {
        lines.push(`Proyecto: ${s.proyecto_descripcion}`)
      } else if (s.proyecto_id) {
        lines.push(`Proyecto: ${s.proyecto_id}`)
      }
      if (s.id_ticket_redmine) {
        lines.push(`Ticket: #${s.id_ticket_redmine}`)
      }
      if (s.cwd) {
        lines.push(`Directorio: ${s.cwd}`)
      }
      return lines.length ? lines.join('\n') : ''
    }

    function createSession() {
      chat.createSession()
    }

    function selectSession(id) {
      const s = chat.sessions.find((s) => s.id === id)
      if (s && s.cwd) cmd.currentDir = s.cwd
      chat.loadMessages(id)
    }

    function ticketPriorityClass(priorityId) {
      if (!priorityId) return ''
      if (priorityId <= 1) return 'ticket-priority-low'
      if (priorityId === 2) return 'ticket-priority-normal'
      if (priorityId === 3) return 'ticket-priority-high'
      if (priorityId >= 5) return 'ticket-priority-immediate'
      if (priorityId >= 4) return 'ticket-priority-urgent'
      return ''
    }

    function getSessionStatus(id) {
      return sessionStatus.value[id] || 'idle'
    }

    function onResizeStart(e) {
      sidebarTransitioning.value = false

      function onMouseMove(e) {
        sidebarWidth.value = Math.max(window.innerWidth * 0.05, Math.min(600, e.clientX))
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

    watch(sidebarCollapsed, () => {
      if (transitionTimer) clearTimeout(transitionTimer)
      sidebarTransitioning.value = true
      transitionTimer = setTimeout(() => {
        sidebarTransitioning.value = false
        transitionTimer = null
      }, 300)
    })

    return {
      chat,
      filteredSessions,
      activeSessionId,
      creating,
      sidebarCollapsed,
      sidebarWidth,
      sidebarTransitioning,
      sessionTooltip,
      getSessionStatus,
      createSession,
      selectSession,
      ticketPriorityClass,
      onResizeStart,
    }
  },
}
</script>

<style scoped>
.sidebar-chat {
  position: relative;
  padding: 8px;
  border-right: 1px solid #374151;

}
.sidebar-chat.transitioning {
  transition: width 0.25s ease, min-width 0.25s ease, padding 0.25s ease, border 0.25s ease;
}
.sidebar-chat.collapsed {
  width: 0 !important;
  min-width: 0 !important;
  padding: 0;
  border: none;
  overflow: hidden;
}
.sidebar-resize-handle {
  position: absolute;
  top: 0;
  right: -6px;
  width: 12px;
  height: 100%;
  cursor: col-resize;
  z-index: 10;
  display: flex;
  align-items: center;
  justify-content: center;
}
.sidebar-resize-handle:hover {
  background: rgba(117, 170, 219, 0.08);
}
.sidebar-resize-handle-bar {
  width: 3px;
  height: 36px;
  background: #374151;
  border-radius: 2px;
  pointer-events: none;
  transition: background 0.15s;
}
.sidebar-resize-handle:hover .sidebar-resize-handle-bar {
  background: #75AADB;
}
.list-group-item {
  color: #e0e0e0;
  border-color: #374151;
  background-color: transparent;
}
.list-group-item:hover {
  background-color: #1a2744;
}
.list-group-item.active {
  border-color: #75AADB !important;
  border-width: 1.5px;
  color: #e0e0e0 !important;
  font-weight: 600;
}
.delete-btn {
  display: none;
  cursor: pointer;
  font-size: 1.2rem;
  line-height: 1;
  color: #e05a6b;
  padding: 0 4px;
  margin-left: 4px;
}
.list-group-item:hover .delete-btn {
  display: inline;
}
.btn-argentina {
  background-color: #75AADB;
  color: #fff;
  border: 1px solid #75AADB;
}
.btn-argentina:hover {
  background-color: #5a8fc0;
  color: #fff;
}
.btn-argentina:disabled {
  opacity: 0.6;
}
.status-led {
  display: inline-block;
  width: 8px;
  height: 8px;
  border-radius: 50%;
  flex-shrink: 0;
  margin-right: 6px;
  transition: background-color 0.2s ease;
}
.status-led.idle {
  background-color: #6b7280;
}
.status-led.executing {
  background-color: #22c55e;
  box-shadow: 0 0 6px #22c55e;
}
.status-led.error {
  background-color: #ef4444;
  box-shadow: 0 0 6px #ef4444;
}
.ticket-badge {
  display: inline-block;
  font-size: 10px;
  font-weight: 600;
  color: #60a5fa;
  margin-right: 4px;
  flex-shrink: 0;
}
.ticket-priority-low {
  border-left: 3px solid var(--priority-low-color, #6b7280) !important;
  background: color-mix(in srgb, var(--priority-low-color, #6b7280) 12%, transparent) !important;
}
.ticket-priority-normal {
  border-left: 3px solid var(--priority-normal-color, #3b82f6) !important;
  background: color-mix(in srgb, var(--priority-normal-color, #3b82f6) 12%, transparent) !important;
}
.ticket-priority-high {
  border-left: 3px solid var(--priority-high-color, #eab308) !important;
  background: color-mix(in srgb, var(--priority-high-color, #eab308) 12%, transparent) !important;
}
.ticket-priority-urgent {
  border-left: 3px solid var(--priority-urgent-color, #ef4444) !important;
  background: color-mix(in srgb, var(--priority-urgent-color, #ef4444) 12%, transparent) !important;
}
.ticket-priority-immediate {
  border-left: 3px solid var(--priority-immediate-color, #ef4444) !important;
  border-left-width: 4px !important;
  background: color-mix(in srgb, var(--priority-immediate-color, #ef4444) 18%, transparent) !important;
}
</style>
