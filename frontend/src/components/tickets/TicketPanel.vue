<template>
  <div class="ticket-panel h-100 d-flex flex-column">
    <div class="d-flex align-items-center gap-2 px-2 py-1 flex-shrink-0">
      <input
        v-model="localFilter"
        class="form-control form-control-sm ticket-filter"
        placeholder="Filtrar tickets..."
      />
      <div class="form-check form-switch mb-0" style="white-space: nowrap;">
        <input
          class="form-check-input"
          type="checkbox"
          role="switch"
          id="projectFilterSwitch"
          v-model="ui.projectFilterEnabled"
          :disabled="!sessionProjectId"
        />
        <label class="form-check-label small" for="projectFilterSwitch">Proyecto</label>
      </div>
      <span class="text-secondary small text-nowrap">{{ filteredTickets.length }} tickets</span>
    </div>

    <div class="ticket-list overflow-y-auto flex-grow-1 px-1">
      <div
        v-for="t in filteredTickets"
        :key="t.id"
        class="ticket-row d-flex align-items-center gap-2 px-2 py-1"
        :class="[ticketPriorityClass(t.priority_id), { active: selectedTicket && selectedTicket.id === t.id }]"
        @click="selectTicket(t)"
      >
        <span class="ticket-id text-nowrap">#{{ t.redmine_id }}</span>
        <span class="ticket-subject text-truncate">{{ t.subject }}</span>
        <span class="ticket-project text-muted text-nowrap">{{ t.proyecto_id }}</span>
        <span class="ticket-priority-label text-nowrap" :class="priorityTextClass(t.priority_id)">
          {{ priorityName(t.priority_id) }}
        </span>
      </div>
      <div v-if="filteredTickets.length === 0" class="text-muted small text-center mt-4">
        No hay tickets
      </div>
    </div>
  </div>
</template>

<script>
import { ref, computed } from 'vue'
import { storeToRefs } from 'pinia'
import { useChatStore } from '../../stores/chat.js'
import { useTicketStore } from '../../stores/ticket.js'
import { useUiStore } from '../../stores/ui.js'
import { useProjectStore } from '../../stores/project.js'

export default {
  setup() {
    const chatStore = useChatStore()
    const ticketStore = useTicketStore()
    const ui = useUiStore()
    const projectStore = useProjectStore()
    const { tickets, selectedTicket } = storeToRefs(ticketStore)
    const { pinnedProjectId } = storeToRefs(projectStore)

    const localFilter = ref('')

    const sessionProjectId = computed(() => {
      const session = chatStore.sessions.find(s => s.id === chatStore.activeSessionId)
      return session?.proyecto_id || null
    })

    function selectTicket(t) {
      ticketStore.selectTicket(t)
    }

    function priorityName(priorityId) {
      if (!priorityId) return 'Sin prioridad'
      if (priorityId <= 1) return 'Baja'
      if (priorityId === 2) return 'Normal'
      if (priorityId === 3) return 'Alta'
      if (priorityId >= 5) return 'Inmediata'
      if (priorityId >= 4) return 'Urgente'
      return ''
    }

    function ticketPriorityClass(priorityId) {
      if (!priorityId) return ''
      if (priorityId <= 1) return 'priority-low'
      if (priorityId === 2) return 'priority-normal'
      if (priorityId === 3) return 'priority-high'
      if (priorityId >= 5) return 'priority-immediate'
      if (priorityId >= 4) return 'priority-urgent'
      return ''
    }

    function priorityTextClass(priorityId) {
      if (!priorityId) return ''
      if (priorityId <= 1) return 'text-priority-low'
      if (priorityId === 2) return 'text-priority-normal'
      if (priorityId === 3) return 'text-priority-high'
      if (priorityId >= 5) return 'text-priority-immediate'
      if (priorityId >= 4) return 'text-priority-urgent'
      return ''
    }

    const filteredTickets = computed(() => {
      const local = localFilter.value.toLowerCase()
      let list = tickets.value

      if (local) {
        list = list.filter((t) => {
          const fields = [String(t.redmine_id), t.subject, t.proyecto_id]
          return fields.some((f) => f && f.toLowerCase().includes(local))
        })
      }

      if (pinnedProjectId.value) {
        list = [...list].sort((a, b) => {
          const aPinned = a.proyecto_id === pinnedProjectId.value ? 0 : 1
          const bPinned = b.proyecto_id === pinnedProjectId.value ? 0 : 1
          return aPinned - bPinned
        })
      }

      if (ui.projectFilterEnabled && sessionProjectId.value) {
        list = list.filter(t => t.proyecto_id === sessionProjectId.value)
      }

      return list
    })

    return {
      localFilter,
      filteredTickets,
      selectedTicket,
      selectTicket,
      priorityName,
      ticketPriorityClass,
      priorityTextClass,
      ui,
      sessionProjectId,
    }
  },
}
</script>

<style scoped>
.ticket-panel {
  background: #1a1a2e;
}
.ticket-filter {
  background: #16213e;
  border: 1px solid #374151;
  color: #e0e0e0;
  font-size: 0.75rem;
}
.ticket-filter::placeholder {
  color: #6b7280;
}
.ticket-filter:focus {
  border-color: #75AADB;
  box-shadow: 0 0 0 0.15rem rgba(117, 170, 219, 0.25);
  background: #16213e;
  color: #e0e0e0;
}
.ticket-list {
  min-height: 0;
}
.ticket-row {
  border-radius: 4px;
  cursor: pointer;
  transition: background 0.1s;
  font-size: 0.75rem;
  min-height: 28px;
  color: #cbd5e1;
}
.ticket-row:hover {
  background: rgba(117, 170, 219, 0.1);
}
.ticket-row.active {
  background: rgba(117, 170, 219, 0.18);
}
.ticket-row.priority-low {
  border-left: 3px solid var(--priority-low-color, #6b7280);
}
.ticket-row.priority-normal {
  border-left: 3px solid var(--priority-normal-color, #3b82f6);
}
.ticket-row.priority-high {
  border-left: 3px solid var(--priority-high-color, #eab308);
}
.ticket-row.priority-urgent {
  border-left: 3px solid var(--priority-urgent-color, #ef4444);
}
.ticket-row.priority-immediate {
  border-left: 3px solid var(--priority-immediate-color, #ef4444);
  border-left-width: 4px;
}
.ticket-id {
  color: #60a5fa;
  font-weight: 600;
  min-width: 55px;
  flex-shrink: 0;
}
.ticket-subject {
  flex: 1;
  min-width: 0;
}
.ticket-project {
  min-width: 80px;
  max-width: 120px;
  text-align: right;
  flex-shrink: 0;
  font-size: 0.65rem;
}
.ticket-priority-label {
  min-width: 60px;
  text-align: right;
  flex-shrink: 0;
  font-size: 0.65rem;
}
.text-priority-low { color: var(--priority-low-color, #6b7280); }
.text-priority-normal { color: var(--priority-normal-color, #3b82f6); }
.text-priority-high { color: var(--priority-high-color, #eab308); }
.text-priority-urgent { color: var(--priority-urgent-color, #ef4444); }
.text-priority-immediate { color: var(--priority-immediate-color, #ef4444); font-weight: 600; }
</style>
