<template>
  <div
    class="d-flex flex-column h-100 bg-dark sidebar-chat"
    :class="{ collapsed: sidebarCollapsed }"
  >
    <button class="btn btn-sm mb-2 flex-shrink-0 btn-argentina" @click="createSession" :disabled="creating">
      {{ creating ? 'Creando...' : '＋ Nuevo chat' }}
    </button>
    <div class="d-flex flex-column flex-grow-1" style="min-height: 0;">
      <button
        class="btn btn-sm w-100 text-start mb-1 flex-shrink-0 btn-outline-argentina"
        @click="toggleSection('chats')"
      >
        {{ expandedSections.chats ? '▼' : '▶' }} Chats
      </button>
      <div v-show="expandedSections.chats" class="overflow-y-auto flex-grow-1" style="min-height: 0;">
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
            <span class="text-truncate">{{ s.title }}</span>
            <span
              class="delete-btn"
              @click.stop="chat.deleteSession(s.id)"
              title="Eliminar conversación"
            >&times;</span>
          </button>
        </div>
      </div>
      <button
        class="btn btn-sm w-100 text-start mb-1 flex-shrink-0 btn-outline-argentina"
        @click="toggleSection('projects')"
      >
        {{ expandedSections.projects ? '▼' : '▶' }} Proyectos
      </button>
      <div v-show="expandedSections.projects" class="overflow-y-auto flex-grow-1" style="min-height: 0;">
        <div class="list-group list-group-flush" style="min-height: 0;">
          <button
            v-for="p in filteredProjects"
            :key="p.id"
            class="list-group-item list-group-item-action py-2 px-2 small d-flex justify-content-between align-items-center"
            :class="{
              active: selectedProject && selectedProject.id === p.id,
              'pinned-project': p.id === pinnedProjectId,
            }"
            @click="selectProject(p)"
          >
            <span
              class="pin-btn"
              :class="{ pinned: p.id === pinnedProjectId }"
              @click.stop="projectStore.togglePin(p.id)"
              title="Fijar proyecto"
            >📌</span>
            <span class="text-truncate ms-1">{{ p.id }} — {{ p.descripcion }}</span>
          </button>
        </div>
      </div>
      <button
        class="btn btn-sm w-100 text-start mb-1 flex-shrink-0 btn-outline-argentina"
        @click="toggleSection('tickets')"
      >
        {{ expandedSections.tickets ? '▼' : '▶' }} Tickets
      </button>
      <div v-show="expandedSections.tickets" class="overflow-y-auto flex-grow-1" style="min-height: 0;">
        <div class="list-group list-group-flush" style="min-height: 0;">
        <button
          v-for="t in filteredTickets"
          :key="t.id"
          class="list-group-item list-group-item-action py-2 px-2 small"
          :class="[
            ticketPriorityClass(t.priority_id),
            {
              active: selectedTicket && selectedTicket.id === t.id,
              'pinned-project': t.proyecto_id === pinnedProjectId,
            },
          ]"
          @click="selectTicket(t)"
        >
          <span class="text-truncate">#{{ t.redmine_id }} — {{ t.subject }}</span>
        </button>
      </div>
    </div>
    </div>
  </div>
</template>

<script>
import { computed, watch, reactive } from 'vue'
import { storeToRefs } from 'pinia'
import { useChatStore } from '../stores/chat.js'
import { useCommandStore } from '../stores/command.js'
import { useUiStore } from '../stores/ui.js'
import { useProjectStore } from '../stores/project.js'
import { useTicketStore } from '../stores/ticket.js'

export default {
  setup() {
    const chat = useChatStore()
    const cmd = useCommandStore()
    const ui = useUiStore()
    const projectStore = useProjectStore()
    const ticketStore = useTicketStore()
    const { sessions, activeSessionId, creating, sessionStatus } = storeToRefs(chat)
    const { sidebarCollapsed, omnifilter } = storeToRefs(ui)
    const { projects, selectedProject, pinnedProjectId } = storeToRefs(projectStore)
    const { tickets, selectedTicket } = storeToRefs(ticketStore)

    const expandedSections = reactive({
      chats: true,
      projects: true,
      tickets: false,
    })

    function toggleSection(name) {
      expandedSections[name] = !expandedSections[name]
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
      projectStore.clearSelection()
      ticketStore.clearSelection()
      const s = chat.sessions.find((s) => s.id === id)
      if (s && s.cwd) cmd.currentDir = s.cwd
      chat.loadMessages(id)
    }

    function selectProject(p) {
      ticketStore.clearSelection()
      projectStore.selectProject(p)
    }

    function selectTicket(t) {
      projectStore.clearSelection()
      ticketStore.selectTicket(t)
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

    const filteredSessions = computed(() => {
      const filter = omnifilter.value.toLowerCase()
      if (!filter) return sessions.value
      return sessions.value.filter((s) => {
        const fields = [s.title, s.proyecto_descripcion, s.proyecto_id, s.cwd]
        return fields.some((f) => f && f.toLowerCase().includes(filter))
      })
    })

    const filteredProjects = computed(() => {
      const filter = omnifilter.value.toLowerCase()
      if (!filter) return projects.value
      return projects.value.filter((p) => {
        return p.id && p.id.toLowerCase().includes(filter)
      })
    })

    const filteredTickets = computed(() => {
      const filter = omnifilter.value.toLowerCase()
      let list = tickets.value
      if (filter) {
        list = list.filter((t) => {
          const fields = [String(t.redmine_id), t.subject, t.proyecto_id]
          return fields.some((f) => f && f.toLowerCase().includes(filter))
        })
      }
      if (pinnedProjectId.value) {
        list = [...list].sort((a, b) => {
          const aPinned = a.proyecto_id === pinnedProjectId.value ? 0 : 1
          const bPinned = b.proyecto_id === pinnedProjectId.value ? 0 : 1
          return aPinned - bPinned
        })
      }
      return list
    })

    watch(omnifilter, (val) => {
      if (val) {
        expandedSections.chats = true
        expandedSections.projects = true
        expandedSections.tickets = true
      }
    })

    return {
      chat,
      filteredSessions,
      activeSessionId,
      creating,
      sidebarCollapsed,
      filteredProjects,
      selectedProject,
      pinnedProjectId,
      projectStore,
      filteredTickets,
      selectedTicket,
      ticketStore,
      expandedSections,
      sessionTooltip,
      getSessionStatus,
      toggleSection,
      createSession,
      selectSession,
      selectProject,
      selectTicket,
      ticketPriorityClass,
    }
  },
}
</script>

<style scoped>
.sidebar-chat {
  width: 220px;
  min-width: 220px;
  padding: 8px;
  border-right: 1px solid #374151;
  transition: width 0.25s ease, min-width 0.25s ease, padding 0.25s ease, border 0.25s ease;
  overflow: hidden;
}
.sidebar-chat.collapsed {
  width: 0;
  min-width: 0;
  padding: 0;
  border: none;
  overflow: hidden;
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
  background-color: #1a2a4e !important;
  border-color: #75AADB !important;
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
.btn-outline-argentina {
  background-color: transparent;
  color: #75AADB;
  border: 1px solid #75AADB;
}
.btn-outline-argentina:hover {
  background-color: #1a2744;
  color: #75AADB;
}
.pin-btn {
  cursor: pointer;
  opacity: 0.3;
  font-size: 0.75rem;
  transition: opacity 0.15s ease;
  line-height: 1;
  flex-shrink: 0;
}
.pin-btn.pinned {
  opacity: 1;
}
.pin-btn:hover {
  opacity: 1;
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
.pinned-project {
  background-color: #1a3344 !important;
  border-left: 3px solid #75AADB !important;
}
.ticket-priority-low {
  border-left: 3px solid #6b7280 !important;
  background-color: rgba(107, 114, 128, 0.12) !important;
}
.ticket-priority-normal {
  border-left: 3px solid #3b82f6 !important;
  background-color: rgba(59, 130, 246, 0.12) !important;
}
.ticket-priority-high {
  border-left: 3px solid #eab308 !important;
  background-color: rgba(234, 179, 8, 0.12) !important;
}
.ticket-priority-urgent {
  border-left: 3px solid #ef4444 !important;
  background-color: rgba(239, 68, 68, 0.12) !important;
}
.ticket-priority-immediate {
  border-left: 3px solid #ef4444 !important;
  border-left-width: 4px !important;
  background-color: rgba(239, 68, 68, 0.18) !important;
}
</style>
