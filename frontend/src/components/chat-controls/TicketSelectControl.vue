<template>
  <div class="ticket-select-control">
    <div class="mb-2 fw-semibold" style="color: #f0f0f0; font-size: 0.85rem;">{{ ticketInfo ? 'Cambiar ticket de la sesión' : 'Seleccionar ticket' }}</div>

    <div v-if="ticketInfo" class="mb-2 px-2 py-1 rounded-2 d-flex align-items-center gap-2" style="background: #0f172a; border: 1px solid #374151;">
      <span class="ticket-badge" :class="priorityClass(ticketInfo.priority_id)"></span>
      <span style="color: #fbbf24; font-weight: 600;">#{{ ticketInfo.redmine_id }}</span>
      <span class="text-muted">—</span>
      <span style="color: #e0e0e0; font-size: 0.8rem;" class="text-truncate">{{ ticketInfo.subject }}</span>
    </div>

    <div class="d-flex gap-2 mb-2">
      <div class="flex-grow-1 position-relative">
        <input
          ref="searchInput"
          v-model="searchQuery"
          type="text"
          class="form-control form-control-sm"
          :placeholder="tickets.length > 0 ? 'Buscar por ID o asunto…' : 'Cargando tickets…'"
          style="background: #0f172a; border: 1px solid #374151; color: #e0e0e0;"
          @input="onSearchInput"
          @keydown.enter.prevent="confirmSearch"
        />
        <div v-if="showDropdown && filteredTickets.length > 0" class="ticket-dropdown">
          <div
            v-for="t in filteredTickets"
            :key="t.redmine_id"
            class="ticket-dropdown-item"
            :class="{ active: highlightedIndex === filteredTickets.indexOf(t) }"
            @click="selectTicket(t)"
            @mouseenter="highlightedIndex = filteredTickets.indexOf(t)"
          >
            <span class="ticket-badge-sm" :class="priorityClass(t.priority_id)"></span>
            <span style="color: #fbbf24; font-weight: 600; min-width: 60px;">#{{ t.redmine_id }}</span>
            <span style="color: #9ca3af; font-size: 0.75rem; margin: 0 4px;">—</span>
            <span class="text-truncate" style="color: #e0e0e0; font-size: 0.8rem;">{{ t.subject }}</span>
          </div>
        </div>
      </div>
    </div>

    <div class="d-flex gap-2 align-items-center">
      <div class="flex-grow-1">
        <label class="small text-muted mb-1 d-block">O ingresa el número de ticket directamente:</label>
        <input
          v-model="directId"
          type="number"
          class="form-control form-control-sm"
          placeholder="Ej: 12345"
          style="background: #0f172a; border: 1px solid #374151; color: #e0e0e0;"
          @keydown.enter.prevent="confirmDirectId"
        />
      </div>
    </div>

    <div class="d-flex gap-2 mt-2">
      <button class="btn btn-sm btn-outline-argentina flex-grow-1" @click="confirmSelected" :disabled="!canConfirm">
        {{ ticketInfo ? 'Cambiar ticket' : 'Asignar ticket' }}
      </button>
      <button class="btn btn-sm btn-outline-secondary" @click="cancel">Cancelar</button>
    </div>
    <div v-if="errorMsg" class="small text-danger mt-1">{{ errorMsg }}</div>
  </div>
</template>

<script>
import { ref, computed, onMounted, nextTick } from 'vue'

export default {
  props: {
    ticketInfo: { type: Object, default: null },
    sessionId: { type: String, default: '' },
  },
  emits: ['confirm'],
  setup(props, { emit }) {
    const tickets = ref([])
    const searchQuery = ref('')
    const directId = ref('')
    const showDropdown = ref(false)
    const highlightedIndex = ref(-1)
    const errorMsg = ref('')
    const searchInput = ref(null)

    const filteredTickets = computed(() => {
      if (!searchQuery.value.trim()) return tickets.value.slice(0, 50)
      const q = searchQuery.value.trim().toLowerCase()
      return tickets.value.filter(t =>
        String(t.redmine_id).includes(q) ||
        (t.subject || '').toLowerCase().includes(q)
      ).slice(0, 50)
    })

    const canConfirm = computed(() => {
      return !!directId.value || (filteredTickets.value.length === 1 && searchQuery.value.trim())
    })

    function priorityClass(priorityId) {
      if (!priorityId) return 'priority-none'
      if (priorityId <= 1) return 'priority-low'
      if (priorityId === 2) return 'priority-normal'
      if (priorityId === 3) return 'priority-high'
      if (priorityId >= 5) return 'priority-immediate'
      if (priorityId >= 4) return 'priority-urgent'
      return 'priority-none'
    }

    async function loadTickets() {
      try {
        const res = await fetch('/api/tickets', { credentials: 'include' })
        const data = await res.json()
        if (data.success && data.tickets) {
          tickets.value = data.tickets
        }
      } catch (err) {
        console.error('Error al cargar tickets:', err)
      }
    }

    function onSearchInput() {
      showDropdown.value = true
      highlightedIndex.value = -1
    }

    function selectTicket(t) {
      searchQuery.value = String(t.redmine_id)
      directId.value = ''
      showDropdown = false
      errorMsg.value = ''
    }

    function confirmSearch() {
      if (filteredTickets.value.length === 1) {
        selectTicket(filteredTickets.value[0])
      }
    }

    function confirmDirectId() {
      if (directId.value) {
        searchQuery.value = ''
        showDropdown.value = false
        confirmSelected()
      }
    }

    function confirmSelected() {
      let idTicket = null
      if (directId.value) {
        idTicket = parseInt(directId.value, 10)
      } else if (filteredTickets.value.length === 1) {
        idTicket = filteredTickets.value[0].redmine_id
      } else if (tickets.value.length > 0) {
        const exact = tickets.value.find(t => String(t.redmine_id) === searchQuery.value.trim())
        if (exact) {
          idTicket = exact.redmine_id
        }
      }

      if (!idTicket || isNaN(idTicket)) {
        errorMsg.value = 'Debe seleccionar un ticket de la lista o ingresar un número válido.'
        return
      }
      errorMsg.value = ''
      emit('confirm', { idTicketRedmine: idTicket })
    }

    function cancel() {
      emit('confirm', null)
    }

    onMounted(async () => {
      await loadTickets()
      await nextTick()
      if (searchInput.value) {
        searchInput.value.focus()
      }
    })

    function handleClickOutside(e) {
      if (!e.target.closest('.ticket-select-control')) {
        showDropdown.value = false
      }
    }

    if (typeof document !== 'undefined') {
      document.addEventListener('click', handleClickOutside)
    }

    return {
      tickets, searchQuery, directId, showDropdown, highlightedIndex,
      filteredTickets, canConfirm, errorMsg, searchInput,
      priorityClass, onSearchInput, selectTicket, confirmSearch,
      confirmDirectId, confirmSelected, cancel,
    }
  },
}
</script>

<style scoped>
.ticket-select-control {
  position: relative;
}
.ticket-dropdown {
  position: absolute;
  top: 100%;
  left: 0;
  right: 0;
  z-index: 100;
  max-height: 220px;
  overflow-y: auto;
  background: #0f172a;
  border: 1px solid #374151;
  border-radius: 4px;
  margin-top: 2px;
}
.ticket-dropdown-item {
  display: flex;
  align-items: center;
  gap: 6px;
  padding: 6px 10px;
  cursor: pointer;
  transition: background 0.15s;
}
.ticket-dropdown-item:hover,
.ticket-dropdown-item.active {
  background: #1a2744;
}
.ticket-badge {
  width: 8px;
  height: 8px;
  border-radius: 50%;
  flex-shrink: 0;
  background: #6b7280;
}
.ticket-badge-sm {
  width: 6px;
  height: 6px;
  border-radius: 50%;
  flex-shrink: 0;
  background: #6b7280;
}
.ticket-badge.priority-low,
.ticket-badge-sm.priority-low {
  background: #9ca3af;
}
.ticket-badge.priority-normal,
.ticket-badge-sm.priority-normal {
  background: #3b82f6;
}
.ticket-badge.priority-high,
.ticket-badge-sm.priority-high {
  background: #eab308;
}
.ticket-badge.priority-urgent,
.ticket-badge-sm.priority-urgent {
  background: #ef4444;
}
.ticket-badge.priority-immediate,
.ticket-badge-sm.priority-immediate {
  background: #ef4444;
  box-shadow: 0 0 4px #ef4444;
}
.btn-outline-argentina {
  background-color: transparent;
  color: #75AADB;
  border: 1px solid #75AADB;
}
.btn-outline-argentina:hover {
  background-color: #1a2a4e;
  color: #75AADB;
}
.btn-outline-argentina:disabled {
  opacity: 0.5;
  cursor: not-allowed;
}
</style>
