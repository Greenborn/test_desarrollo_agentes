<template>
  <div
    class="sidebar-chat d-flex flex-column h-100 bg-dark"
    :class="{ collapsed: sidebarCollapsed, transitioning: sidebarTransitioning }"
    :style="sidebarStyle"
  >
    <!-- Tab bar -->
    <div class="tab-bar d-flex align-items-center px-3 pt-0 pb-1 flex-shrink-0">
      <button class="tab-btn" :class="{ active: tab === 'chats' }" @click="selectChatTab('chats')">Chats</button>
      <button class="tab-btn ms-3" :class="{ active: tab === 'servicios' }" @click="selectChatTab('servicios')">Servicios</button>
      <button class="tab-btn ms-3" :class="{ active: tab === 'archived' }" @click="selectChatTab('archived')">Archivados</button>
    </div>
    <div v-if="tab === 'chats'" class="d-flex flex-column flex-grow-1" style="min-height: 0;">
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
          <span v-if="pendingNotifications[s.id]" class="notification-dot" title="Novedades pendientes"></span>
            <a v-if="s.id_ticket_redmine"
               class="ticket-badge"
               :href="`${s.session_redmine_url || redmineUrl}/issues/${s.id_ticket_redmine}`"
               target="_blank" rel="noopener noreferrer"
               @click.stop
               :style="ticketBadgeStyle(s)"
               title="Abrir ticket en Redmine">#{{ s.id_ticket_redmine }}</a>
          <div class="d-flex flex-column flex-grow-1 min-width-0">
            <span class="text-truncate">{{ s.title }}</span>
            <span class="text-muted" style="font-size: 0.6rem; line-height: 1.2;">{{ formatDate(s.updated_at) }}</span>
          </div>
          <div class="d-flex flex-column gap-1">
            <span v-if="showWorkspaceBadges && workspaceMap[s.workspace_id]"
                  class="workspace-badge"
                  :style="workspaceBadgeStyle(workspaceMap[s.workspace_id])"
                  title="Espacio de trabajo">{{ workspaceMap[s.workspace_id].name }}</span>
            <span v-if="s.proyecto_id"
                  class="project-badge"
                  title="Proyecto">{{ s.proyecto_id }}</span>
          </div>
          <span
            class="archive-btn"
            @click.stop="archiveSession(s.id)"
            title="Archivar"
          >&#128451;</span>
          <span
            class="delete-btn"
            @click.stop="chat.deleteSession(s.id)"
            title="Eliminar conversación"
          >&times;</span>
        </button>
      </div>
    </div>
    </div>
    <div v-if="tab === 'archived'" class="d-flex flex-column flex-grow-1" style="min-height: 0;">
      <div class="overflow-y-auto flex-grow-1" style="min-height: 0;">
        <div class="list-group list-group-flush" style="min-height: 0;">
          <button
            v-for="s in filteredArchivedSessions"
            :key="s.id"
            class="list-group-item list-group-item-action py-2 px-2 small d-flex justify-content-between align-items-center"
            :class="[{ active: s.id === activeSessionId }, ticketPriorityClass(s.priority_id)]"
            :title="sessionTooltip(s)"
            @click="selectSession(s.id)"
          >
            <span class="status-led archived"></span>
            <a v-if="s.id_ticket_redmine"
               class="ticket-badge"
               :href="`${s.session_redmine_url || redmineUrl}/issues/${s.id_ticket_redmine}`"
               target="_blank" rel="noopener noreferrer"
               @click.stop
               :style="ticketBadgeStyle(s)"
               title="Abrir ticket en Redmine">#{{ s.id_ticket_redmine }}</a>
            <div class="d-flex flex-column flex-grow-1 min-width-0">
              <span class="text-truncate">{{ s.title }}</span>
              <span class="text-muted" style="font-size: 0.6rem; line-height: 1.2;">{{ formatDate(s.updated_at) }}</span>
            </div>
            <div class="d-flex flex-column gap-1">
              <span v-if="showWorkspaceBadges && workspaceMap[s.workspace_id]"
                    class="workspace-badge"
                    :style="workspaceBadgeStyle(workspaceMap[s.workspace_id])"
                    title="Espacio de trabajo">{{ workspaceMap[s.workspace_id].name }}</span>
              <span v-if="s.proyecto_id"
                    class="project-badge"
                    title="Proyecto">{{ s.proyecto_id }}</span>
            </div>
            <span
              class="unarchive-btn"
              @click.stop="unarchiveSession(s.id)"
              title="Desarchivar"
            >&#128194;</span>
            <span
              class="delete-btn"
              @click.stop="chat.deleteSession(s.id)"
              title="Eliminar conversación"
            >&times;</span>
          </button>
        </div>
      </div>
    </div>
    <ServiciosPanel v-if="tab === 'servicios'" class="flex-grow-1" style="min-height: 0;" />
    <div class="sidebar-resize-handle" @mousedown.prevent="onResizeStart">
      <div class="sidebar-resize-handle-bar"></div>
    </div>
  </div>
</template>

<script>
import { computed, watch, ref, onMounted } from 'vue'
import { storeToRefs } from 'pinia'
import { useChatStore } from '../../stores/chat.js'
import { useCommandStore } from '../../stores/command.js'
import { useUiStore } from '../../stores/ui.js'
import { useSettingsStore } from '../../stores/settings.js'
import { useWorkspaceStore } from '../../stores/workspace.js'
import { contrastTextColor } from '../../utils/color.js'
import ServiciosPanel from '../services/ServiciosPanel.vue'

export default {
  components: { ServiciosPanel },
  setup() {
    const chat = useChatStore()
    const cmd = useCommandStore()
    const ui = useUiStore()
    const settings = useSettingsStore()
    const ws = useWorkspaceStore()
    const { sessions, archivedSessions, activeSessionId, creating, sessionStatus, pendingNotifications } = storeToRefs(chat)
    const { sidebarCollapsed, sidebarWidth, centralPanelCollapsed, sidebarWidthPct, rightPanelCollapsed, omnifilter, sidebarChatTab } = storeToRefs(ui)
    const tab = ref('chats')
    const stopTabSync = watch(sidebarChatTab, (v) => { tab.value = v; stopTabSync() })
    const { redmineUrl } = storeToRefs(settings)
    const { workspaces, selectedIds } = storeToRefs(ws)

    const showWorkspaceBadges = computed(() => selectedIds.value.length > 1)
    const workspaceMap = computed(() => {
      const map = {}
      for (const w of workspaces.value) {
        map[w.id] = { name: w.name, color: w.color || '#75AADB' }
      }
      return map
    })

    function workspaceBadgeStyle(ws) {
      if (!ws || !ws.color) return {}
      return { backgroundColor: ws.color, color: contrastTextColor(ws.color) }
    }

    function ticketBadgeStyle(s) {
      const ws = workspaceMap.value[s.workspace_id]
      if (ws && ws.color) return { color: ws.color }
      return {}
    }

    const sidebarTransitioning = ref(false)
    let transitionTimer = null

    const sidebarStyle = computed(() => {
      if (sidebarCollapsed.value) return {}
      if (centralPanelCollapsed.value) {
        if (rightPanelCollapsed.value) {
          return { flex: '1 1 100%', minWidth: '5vw' }
        }
        return { flex: `0 0 ${sidebarWidthPct.value}%`, minWidth: '5vw' }
      }
      return { width: sidebarWidth.value + 'px', minWidth: sidebarWidth.value + 'px' }
    })

    const filteredSessions = computed(() => {
      const filter = omnifilter.value.toLowerCase()
      if (!filter) return sessions.value
      return sessions.value.filter((s) => {
        const fields = [s.title, s.proyecto_descripcion, s.proyecto_id, s.cwd]
        return fields.some((f) => f && f.toLowerCase().includes(filter))
      })
    })

    const filteredArchivedSessions = computed(() => {
      const filter = omnifilter.value.toLowerCase()
      if (!filter) return archivedSessions.value
      return archivedSessions.value.filter((s) => {
        const fields = [s.title, s.proyecto_descripcion, s.proyecto_id, s.cwd]
        return fields.some((f) => f && f.toLowerCase().includes(filter))
      })
    })

    function formatDate(dateStr) {
      if (!dateStr) return ''
      const d = new Date(dateStr)
      return d.toLocaleDateString('es-AR', { day: '2-digit', month: '2-digit', year: '2-digit', hour: '2-digit', minute: '2-digit' })
    }

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
      const s = chat.sessions.find((s) => s.id === id) || chat.archivedSessions.find((s) => s.id === id)
      if (s && s.cwd) cmd.currentDir = s.cwd
      chat.loadMessages(id)
    }

    function selectChatTab(val) {
      tab.value = val
      sidebarChatTab.value = val
      ui.saveLayoutPrefs()
      if (val === 'archived') {
        chat.loadArchivedSessions()
      }
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
      if (chat.ledFlash?.[id]) return 'flash'
      return sessionStatus.value[id] || 'idle'
    }

    function onResizeStart(e) {
      sidebarTransitioning.value = false
      const resizeHandle = e.currentTarget

      function onMouseMove(e) {
        if (ui.centralPanelCollapsed) {
          const container = resizeHandle.closest('.sidebar-chat')?.parentElement
          const containerWidth = container ? container.getBoundingClientRect().width : window.innerWidth
          const pct = (e.clientX / containerWidth) * 100
          ui.setSidebarWidthPct(pct)
        } else {
          const maxAllowed = Math.max(window.innerWidth * 0.05, window.innerWidth - (ui.rightPanelCollapsed ? 0 : ui.rightPanelWidth) - window.innerWidth * 0.05)
          sidebarWidth.value = Math.max(window.innerWidth * 0.05, Math.min(maxAllowed, e.clientX))
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

    watch(sidebarCollapsed, () => {
      if (transitionTimer) clearTimeout(transitionTimer)
      sidebarTransitioning.value = true
      transitionTimer = setTimeout(() => {
        sidebarTransitioning.value = false
        transitionTimer = null
      }, 300)
    })

    function archiveSession(id) {
      chat.archiveSession(id)
    }

    function unarchiveSession(id) {
      chat.unarchiveSession(id)
    }

    return {
      tab,
      selectChatTab,
      chat,
      filteredSessions,
      filteredArchivedSessions,
      activeSessionId,
      creating,
      pendingNotifications,
      sidebarCollapsed,
      sidebarWidth,
      sidebarTransitioning,
      sidebarStyle,
      sessionTooltip,
      formatDate,
      redmineUrl,
      showWorkspaceBadges,
      workspaceMap,
      getSessionStatus,
      createSession,
      selectSession,
      ticketPriorityClass,
      onResizeStart,
      workspaceBadgeStyle,
      ticketBadgeStyle,
      archiveSession,
      unarchiveSession,
    }
  },
}
</script>

<style scoped>
.tab-bar {
  border-bottom: 1px solid #374151;
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
.tab-label {
  color: #75AADB;
  font-size: 0.75rem;
  padding: 4px 10px;
  border-bottom: 2px solid #75AADB;
}
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
.archive-btn {
  display: none;
  cursor: pointer;
  font-size: 1rem;
  line-height: 1;
  color: #75AADB;
  padding: 0 4px;
  margin-left: 4px;
}
.list-group-item:hover .archive-btn {
  display: inline;
}
.unarchive-btn {
  display: none;
  cursor: pointer;
  font-size: 1rem;
  line-height: 1;
  color: #22c55e;
  padding: 0 4px;
  margin-left: 4px;
}
.list-group-item:hover .unarchive-btn {
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
.status-led.flash {
  background-color: #3b82f6;
  box-shadow: 0 0 6px #3b82f6;
}
.status-led.archived {
  background-color: #6b7280;
  opacity: 0.4;
}
.notification-dot {
  display: inline-block;
  width: 8px;
  height: 8px;
  border-radius: 50%;
  flex-shrink: 0;
  margin-right: 4px;
  background-color: #75AADB;
  box-shadow: 0 0 6px #75AADB;
  animation: pulse-dot 1.5s ease-in-out infinite;
}
@keyframes pulse-dot {
  0%, 100% { opacity: 1; transform: scale(1); }
  50% { opacity: 0.5; transform: scale(0.8); }
}
.ticket-badge {
  display: inline-block;
  font-size: 10px;
  font-weight: 600;
  margin-right: 4px;
  flex-shrink: 0;
  text-decoration: none;
  cursor: pointer;
}
.ticket-badge:hover {
  filter: brightness(1.3);
  text-decoration: underline;
}
.workspace-badge {
  display: inline-block;
  font-size: 9px;
  font-weight: 600;
  border-radius: 3px;
  padding: 0 5px;
  margin-left: 4px;
  line-height: 1.5;
  flex-shrink: 0;
  white-space: nowrap;
}
.project-badge {
  display: inline-block;
  font-size: 9px;
  font-weight: 600;
  border-radius: 3px;
  padding: 0 5px;
  margin-left: 4px;
  line-height: 1.5;
  flex-shrink: 0;
  white-space: nowrap;
  background-color: #2d3748;
  color: #a0aec0;
  font-family: 'SFMono-Regular', Consolas, 'Liberation Mono', Menlo, monospace;
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
