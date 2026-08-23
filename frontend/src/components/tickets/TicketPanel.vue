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

    <div class="flex-grow-1 min-h-0">
      <TableEditor
        id="tickets"
        :data="tableData"
        :config="tableConfig"
        @rowSelected="onRowSelected"
      />
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
import { TableEditor } from 'vue-table-editor'
import { createPiniaPrefsAdapter } from '../TableEditor/preferenciasAdapter.js'

export default {
  components: { TableEditor },
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

    const tableData = computed(() => ({
      fields_def: [
        { field: 'redmine_id', headerName: '#' },
        { field: 'subject', headerName: 'Asunto' },
        { field: 'proyecto_id', headerName: 'Proyecto' },
        { field: 'priority_name', headerName: 'Prioridad' },
      ],
      rows: filteredTickets.value.map(t => ({
        id: t.id,
        redmine_id: t.redmine_id,
        subject: t.subject,
        proyecto_id: t.proyecto_id,
        priority_name: priorityName(t.priority_id),
        _priority_id: t.priority_id,
        _ticket: t,
      })),
    }))

    const tableConfig = {
      selectionMode: 'single',
      hideToolbar: true,
      showPaginator: false,
      preferencesStore: createPiniaPrefsAdapter(),
      styling: {
        rowClassFn: (row) => ticketPriorityClass(row._priority_id),
      },
      valueFormatters: {
        redmine_id: (row) => `#${row.redmine_id}`,
        priority_name: (row) => {
          const pid = row._priority_id
          let color
          if (!pid) color = '#6b7280'
          else if (pid <= 1) color = '#6b7280'
          else if (pid === 2) color = '#3b82f6'
          else if (pid === 3) color = '#eab308'
          else if (pid >= 5) color = '#ef4444'
          else color = '#ef4444'
          const weight = pid >= 5 ? '600' : '400'
          return `<span style="color:${color};font-weight:${weight}">${row.priority_name}</span>`
        },
      },
    }

    function onRowSelected(row) {
      if (row?._ticket) ticketStore.selectTicket(row._ticket)
    }

    return {
      localFilter,
      filteredTickets,
      tableData,
      tableConfig,
      onRowSelected,
      ui,
      sessionProjectId,
      createPiniaPrefsAdapter,
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

.ticket-panel :deep(.te-wrapper) {
  background: #1a1a2e;
}
.ticket-panel :deep(.te-scroll-wrap) {
  background: #16213e;
  border-color: #374151;
}
.ticket-panel :deep(.te-table) {
  color: #cbd5e1;
}
.ticket-panel :deep(.te-th) {
  background: #1a1a2e !important;
  color: #94a3b8 !important;
  border-bottom-color: #374151 !important;
  border-right-color: #2a2a3e !important;
}
.ticket-panel :deep(.te-td) {
  background: #16213e;
  color: #cbd5e1;
  border-bottom-color: #1e2a3a;
  border-right-color: #1e2a3a;
}
.ticket-panel :deep(.te-tr:hover .te-td) {
  background: rgba(117, 170, 219, 0.1) !important;
}
.ticket-panel :deep(.te-tr.te-tr-highlight .te-td),
.ticket-panel :deep(.te-tr.te-tr-selected .te-td) {
  background: rgba(117, 170, 219, 0.18) !important;
}
.ticket-panel :deep(.te-tr.te-tr-highlight:hover .te-td) {
  background: rgba(117, 170, 219, 0.22) !important;
}
.ticket-panel :deep(.te-empty) {
  color: #6b7280;
}
.ticket-panel :deep(.te-td-sel) {
  border-right-color: #374151 !important;
}

.ticket-panel :deep(.te-tr.priority-low) {
  box-shadow: inset 3px 0 0 0 var(--priority-low-color, #6b7280);
}
.ticket-panel :deep(.te-tr.priority-normal) {
  box-shadow: inset 3px 0 0 0 var(--priority-normal-color, #3b82f6);
}
.ticket-panel :deep(.te-tr.priority-high) {
  box-shadow: inset 3px 0 0 0 var(--priority-high-color, #eab308);
}
.ticket-panel :deep(.te-tr.priority-urgent) {
  box-shadow: inset 3px 0 0 0 var(--priority-urgent-color, #ef4444);
}
.ticket-panel :deep(.te-tr.priority-immediate) {
  box-shadow: inset 3px 0 0 0 var(--priority-immediate-color, #ef4444);
}
</style>
