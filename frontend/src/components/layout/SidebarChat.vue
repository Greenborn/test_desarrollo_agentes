<template>
  <div
    class="sidebar-chat d-flex flex-column h-100 bg-dark"
    :class="{ collapsed: sidebarCollapsed, transitioning: sidebarTransitioning }"
    :style="sidebarStyle"
  >
    <!-- Tab bar -->
    <div class="tab-bar d-flex align-items-center px-3 pt-0 pb-1 flex-shrink-0">
      <button v-for="t in allChatTabs" :key="t.id" class="tab-btn" :class="{ active: tab === t.id }" @click="selectChatTab(t.id)">{{ t.label }}</button>
    </div>
    <div v-if="tab === 'chats'" class="d-flex flex-column flex-grow-1" style="min-height: 0;">
    <div class="d-flex align-items-center gap-2 mb-2 flex-shrink-0">
      <button class="btn btn-sm flex-shrink-0 btn-argentina" @click="createSession" :disabled="creating" style="flex:1;">
        {{ creating ? 'Creando...' : '＋ Nuevo chat' }}
      </button>
      <label class="session-nav-toggle" title="Barra flotante de sesiones">
        <input type="checkbox" v-model="sessionNavEnabled" />
        <span class="toggle-slider"></span>
      </label>
    </div>
    <div class="overflow-y-auto flex-grow-1" style="min-height: 0;">
      <div class="list-group list-group-flush" style="min-height: 0;">
        <button
          v-for="s in filteredSessions"
          :key="s.id"
          class="list-group-item list-group-item-action py-2 px-2 small d-flex justify-content-between align-items-center"
          :class="[{ active: s.id === activeSessionId }, ticketPriorityClass(s.priority_id)]"
          :title="sessionTooltip(s)"
          @click="selectSession(s.id)"
          @contextmenu.prevent="onSessionContextMenu($event, s)"
        >
          <div class="session-icon" :style="sessionIconStyle(s)">
            <span v-if="pendingNotifications[s.id]" class="session-icon-notif" title="Novedades pendientes"></span>
            <a v-if="s.id_ticket_redmine"
               class="session-icon-ticket"
               :href="`${s.session_redmine_url || redmineUrl}/issues/${s.id_ticket_redmine}`"
               target="_blank" rel="noopener noreferrer"
               @click.stop
               title="Abrir ticket en Redmine">#{{ s.id_ticket_redmine }}</a>
            <span class="session-icon-led" :class="getSessionStatus(s.id)"></span>
          </div>
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
            @contextmenu.prevent="onSessionContextMenu($event, s)"
          >
            <div class="session-icon" :style="sessionIconStyle(s)">
              <a v-if="s.id_ticket_redmine"
                 class="session-icon-ticket"
                 :href="`${s.session_redmine_url || redmineUrl}/issues/${s.id_ticket_redmine}`"
                 target="_blank" rel="noopener noreferrer"
                 @click.stop
                 title="Abrir ticket en Redmine">#{{ s.id_ticket_redmine }}</a>
              <span class="session-icon-led archived"></span>
            </div>
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
    <component :is="activeRegistryChatComponent" v-if="activeRegistryChatComponent" class="flex-grow-1" style="min-height: 0;" />
    <div class="sidebar-resize-handle" @mousedown.prevent="onResizeStart">
      <div class="sidebar-resize-handle-bar"></div>
    </div>
  </div>
  <!-- Floating session nav bar -->
  <div v-if="sessionNavEnabled && filteredSessions.length" class="session-nav-bar">
    <button
      v-for="s in filteredSessions"
      :key="s.id"
      class="session-nav-btn"
      :class="{ active: s.id === activeSessionId }"
      :title="s.title || `Sesión #${s.id}`"
      @click="selectSession(s.id)"
    >
      <div class="session-nav-icon" :style="navIconStyle(s)">
        <span v-if="s.id_ticket_redmine" class="session-nav-ticket">#{{ s.id_ticket_redmine }}</span>
        <span class="session-nav-led" :class="getSessionStatus(s.id)"></span>
      </div>
    </button>
  </div>
    <div v-if="ctxMenu.show" class="context-menu-backdrop" @click="closeSessionCtxMenu" @contextmenu.prevent="closeSessionCtxMenu"></div>
    <div v-if="ctxMenu.show" ref="menuRef" class="context-menu" :style="{ left: ctxMenu.x + 'px', top: ctxMenu.y + 'px' }" @click.stop>
    <div v-if="tab === 'chats'" class="context-menu-item" @click="archiveFromCtxMenu">&#128451; Archivar</div>
    <div v-if="tab === 'archived'" class="context-menu-item" @click="unarchiveFromCtxMenu">&#128194; Desarchivar</div>
    <div class="context-menu-item" @click="cloneFromCtxMenu">&#128203; Clonar sesión</div>
    <div class="context-menu-divider"></div>
    <div class="context-menu-item text-danger" @click="deleteFromCtxMenu">&times; Eliminar</div>
  </div>
</template>

<script>
import { computed, watch, ref, reactive, onMounted, nextTick } from 'vue'
import { storeToRefs } from 'pinia'
import { useChatStore } from '../../stores/chat.js'
import { useCommandStore } from '../../stores/command.js'
import { useUiStore } from '../../stores/ui.js'
import { useSettingsStore } from '../../stores/settings.js'
import { useWorkspaceStore } from '../../stores/workspace.js'
import { contrastTextColor } from '../../utils/color.js'
import ServiciosPanel from '../services/ServiciosPanel.vue'
import { useModuleRegistry } from '../../composables/useModuleRegistry.js'
import { adjustContextMenuPosition } from '../../utils/contextMenu.js'

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
    const { sidebarChatTabs } = useModuleRegistry()

    const builtInChatTabs = [
      { id: 'chats', label: 'Chats', priority: 10 },
      { id: 'servicios', label: 'Servicios', priority: 20 },
      { id: 'archived', label: 'Archivados', priority: 30 },
    ]
    const allChatTabs = computed(() => {
      if (!sidebarChatTabs) return builtInChatTabs
      return [...builtInChatTabs, ...sidebarChatTabs].sort((a, b) => (a.priority || 50) - (b.priority || 50))
    })
    const activeRegistryChatComponent = computed(() => {
      if (!sidebarChatTabs) return null
      const found = sidebarChatTabs.find(t => t.id === tab.value)
      return found ? found.component : null
    })

    const sessionNavEnabled = ref(false)

    async function loadSessionNavPref() {
      try {
        const { settingGet } = await import('../../services/settingService.js')
        const data = await settingGet('session_nav_enabled')
        if (data.value !== null) sessionNavEnabled.value = data.value === 'true'
      } catch (err) {
        console.error('Error loading session nav pref:', err)
      }
    }
    loadSessionNavPref()

    watch(sessionNavEnabled, async (val) => {
      try {
        const { settingSet } = await import('../../services/settingService.js')
        await settingSet('session_nav_enabled', String(val))
      } catch (err) {
        console.error('Error saving session nav pref:', err)
      }
    })

    const ctxMenu = reactive({ show: false, x: 0, y: 0, session: null })
    const menuRef = ref(null)

    function onSessionContextMenu(e, session) {
      ctxMenu.show = true
      ctxMenu.x = e.clientX
      ctxMenu.y = e.clientY
      ctxMenu.session = session
      nextTick(() => {
        if (menuRef.value) {
          const adjusted = adjustContextMenuPosition(menuRef.value, ctxMenu.x, ctxMenu.y)
          ctxMenu.x = adjusted.x
          ctxMenu.y = adjusted.y
        }
      })
    }

    function closeSessionCtxMenu() {
      ctxMenu.show = false
      ctxMenu.session = null
    }

    function archiveFromCtxMenu() {
      const session = ctxMenu.session
      closeSessionCtxMenu()
      if (session) chat.archiveSession(session.id)
    }

    function unarchiveFromCtxMenu() {
      const session = ctxMenu.session
      closeSessionCtxMenu()
      if (session) chat.unarchiveSession(session.id)
    }

    async function cloneFromCtxMenu() {
      const session = ctxMenu.session
      closeSessionCtxMenu()
      if (session) {
        const cloned = await chat.cloneSession(session.id)
        if (cloned) {
          chat.loadMessages(cloned.id)
        } else {
          modal.open(AlertModal, { message: 'No se pudo clonar la sesión. Consulta la consola para más detalles.' }, { title: 'Error' })
        }
      }
    }

    function deleteFromCtxMenu() {
      const session = ctxMenu.session
      closeSessionCtxMenu()
      if (session) chat.deleteSession(session.id)
    }

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

    function sessionIconStyle(s) {
      const color = s.proyecto_color || '#374151'
      return { backgroundColor: color }
    }

    function navIconStyle(s) {
      const color = s.proyecto_color || '#374151'
      return { backgroundColor: color }
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
      sessionIconStyle,
      navIconStyle,
      archiveSession,
      unarchiveSession,
      ctxMenu,
      menuRef,
      onSessionContextMenu,
      closeSessionCtxMenu,
      sessionNavEnabled,
      allChatTabs,
      activeRegistryChatComponent,
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
.session-icon {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  width: 32px;
  height: 32px;
  border-radius: 6px;
  flex-shrink: 0;
  margin-right: 8px;
  position: relative;
  gap: 1px;
}
.session-icon-led {
  display: block;
  width: 6px;
  height: 6px;
  border-radius: 50%;
  flex-shrink: 0;
  transition: background-color 0.2s ease;
}
.session-icon-led.idle {
  background-color: #6b7280;
}
.session-icon-led.executing {
  background-color: #22c55e;
  box-shadow: 0 0 6px #22c55e;
}
.session-icon-led.error {
  background-color: #ef4444;
  box-shadow: 0 0 6px #ef4444;
}
.session-icon-led.flash {
  background-color: #22c55e;
  box-shadow: 0 0 6px #22c55e;
}
.session-icon-led.archived {
  background-color: #6b7280;
  opacity: 0.4;
}
.session-icon-ticket {
  font-size: 9px;
  font-weight: 700;
  line-height: 1;
  text-decoration: none;
  cursor: pointer;
  color: #fff;
  text-shadow: 0 1px 2px rgba(0,0,0,0.5);
}
.session-icon-ticket:hover {
  filter: brightness(1.3);
  text-decoration: underline;
}
.session-icon-notif {
  position: absolute;
  top: -2px;
  right: -2px;
  width: 7px;
  height: 7px;
  border-radius: 50%;
  background-color: #75AADB;
  box-shadow: 0 0 6px #75AADB;
  animation: pulse-icon-dot 1.5s ease-in-out infinite;
}
@keyframes pulse-icon-dot {
  0%, 100% { opacity: 1; transform: scale(1); }
  50% { opacity: 0.5; transform: scale(0.8); }
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

.session-nav-toggle {
  position: relative;
  display: inline-block;
  width: 32px;
  height: 18px;
  flex-shrink: 0;
  cursor: pointer;
}
.session-nav-toggle input {
  opacity: 0;
  width: 0;
  height: 0;
}
.toggle-slider {
  position: absolute;
  inset: 0;
  background-color: #374151;
  border-radius: 9px;
  transition: background-color 0.2s;
}
.toggle-slider::before {
  content: '';
  position: absolute;
  width: 14px;
  height: 14px;
  left: 2px;
  top: 2px;
  background-color: #9ca3af;
  border-radius: 50%;
  transition: transform 0.2s, background-color 0.2s;
}
.session-nav-toggle input:checked + .toggle-slider {
  background-color: #75AADB;
}
.session-nav-toggle input:checked + .toggle-slider::before {
  transform: translateX(14px);
  background-color: #fff;
}

.session-nav-bar {
  position: fixed;
  bottom: 0;
  left: 0;
  right: 0;
  z-index: 1050;
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 4px;
  padding: 6px 12px;
  background: rgba(17, 24, 39, 0.92);
  border-top: 1px solid #374151;
  overflow-x: auto;
  backdrop-filter: blur(6px);
}
.session-nav-btn {
  flex-shrink: 0;
  width: 36px;
  height: 36px;
  border-radius: 6px;
  border: 1px solid #374151;
  background: #1f2937;
  cursor: pointer;
  display: flex;
  align-items: center;
  justify-content: center;
  transition: border-color 0.15s;
  padding: 0;
}
.session-nav-btn:hover {
  border-color: #75AADB;
}
.session-nav-btn.active {
  border-color: #75AADB;
}
.session-nav-icon {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  width: 28px;
  height: 28px;
  border-radius: 4px;
  gap: 1px;
}
.session-nav-ticket {
  font-size: 7px;
  font-weight: 700;
  line-height: 1;
  text-decoration: none;
  cursor: pointer;
  color: #fff;
  text-shadow: 0 1px 2px rgba(0,0,0,0.5);
}
.session-nav-ticket:hover {
  filter: brightness(1.3);
  text-decoration: underline;
}
.session-nav-led {
  display: block;
  width: 5px;
  height: 5px;
  border-radius: 50%;
  flex-shrink: 0;
}
.session-nav-led.idle {
  background-color: #6b7280;
}
.session-nav-led.executing {
  background-color: #22c55e;
  box-shadow: 0 0 4px #22c55e;
}
.session-nav-led.error {
  background-color: #ef4444;
  box-shadow: 0 0 4px #ef4444;
}
.session-nav-led.flash {
  background-color: #22c55e;
  box-shadow: 0 0 4px #22c55e;
}
.session-nav-led.archived {
  background-color: #6b7280;
  opacity: 0.4;
}
.context-menu-backdrop {
  position: fixed;
  top: 0; left: 0; right: 0; bottom: 0;
  z-index: 1040;
}
.context-menu {
  position: fixed;
  z-index: 1050;
  background: #1a2744;
  border: 1px solid #75AADB;
  border-radius: 6px;
  padding: 4px 0;
  min-width: 180px;
  box-shadow: 0 4px 12px rgba(0,0,0,0.4);
}
.context-menu-item {
  padding: 8px 16px;
  cursor: pointer;
  font-size: 0.875rem;
  color: #e0e0e0;
}
.context-menu-item:hover {
  background: #1a2a4e;
}
.context-menu-item.text-danger {
  color: #f87171;
}
.context-menu-item.text-danger:hover {
  background: rgba(248, 113, 113, 0.12);
}
.context-menu-divider {
  height: 1px;
  background: #374151;
  margin: 4px 0;
}
</style>
