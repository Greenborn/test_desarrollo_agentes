<template>
  <div class="ticket-edit-control">
    <div class="ticket-header mb-3">
      <span class="ticket-id">#{{ ticket.redmine_id }}</span>
      <input
        v-model="form.subject"
        class="ticket-input title-input"
        placeholder="Asunto del ticket"
        :class="{ 'is-invalid': errors.subject }"
        @input="errors.subject = ''"
      />
      <div v-if="errors.subject" class="error-msg">{{ errors.subject }}</div>
    </div>

    <div class="ticket-field row-fields">
      <div class="field-item">
        <span class="field-label">Estado:</span>
        <select v-model="form.status_name" class="ticket-select" @change="onStatusChange">
          <option value="" disabled>Selecciona estado...</option>
          <option v-for="s in statusOptions" :key="s.id || s.name" :value="s.name">{{ s.name }}</option>
        </select>
      </div>
      <div class="field-item">
        <span class="field-label">Prioridad:</span>
        <select v-if="options.priorities.length" v-model="form.priority_name" class="ticket-select" @change="onPriorityChange">
          <option value="" disabled>Selecciona prioridad...</option>
          <option v-for="p in options.priorities" :key="p.id" :value="p.name">{{ p.name }}</option>
        </select>
        <input v-else v-model="form.priority_name" class="ticket-input" placeholder="Prioridad" />
      </div>
      <div class="field-item">
        <span class="field-label">Asignado a:</span>
        <select v-if="options.users.length" v-model="form.assigned_to_name" class="ticket-select" @change="onUserChange">
          <option value="">— Sin asignar —</option>
          <option v-for="u in options.users" :key="u.id" :value="u.name">{{ u.name }}</option>
        </select>
        <input v-else v-model="form.assigned_to_name" class="ticket-input" placeholder="Asignado a" />
      </div>
      <div class="field-item">
        <span class="field-label">% Avance:</span>
        <div class="done-ratio-wrapper">
          <input type="range" min="0" max="100" step="1" v-model.number="form.done_ratio" class="done-ratio-slider" />
          <span class="done-ratio-value">{{ form.done_ratio ?? 0 }}%</span>
        </div>
      </div>
    </div>
    <div class="ticket-field">
      <span class="field-value-readonly">Proyecto: {{ ticket.proyecto_id }}</span>
    </div>

    <div class="ticket-field description-field">
      <span class="field-label">Descripción:</span>
      <textarea
        v-model="form.description"
        class="ticket-textarea"
        rows="4"
        placeholder="Descripción del ticket"
      ></textarea>
    </div>

    <div class="ticket-field">
      <span class="field-label">Nuevo comentario:</span>
      <textarea
        v-model="form.notes"
        class="ticket-textarea"
        rows="2"
        placeholder="Agregar un comentario..."
      ></textarea>
    </div>

    <div class="d-flex gap-2 mt-3">
      <button class="btn btn-sm btn-argentina" @click="save" :disabled="saving">
        {{ saving ? 'Guardando...' : 'Guardar' }}
      </button>
      <button class="btn btn-sm btn-outline-argentina" @click="cancel" :disabled="saving">
        Cancelar
      </button>
    </div>
  </div>
</template>

<script>
import { ref, reactive, onMounted, computed } from 'vue'

const API = '/api'

export default {
  props: {
    ticket: { type: Object, required: true },
  },
  emits: ['confirm'],
  setup(props, { emit }) {
    const saving = ref(false)
    const errors = reactive({ subject: '' })
    const options = reactive({
      statuses: [],
      priorities: [],
      users: [],
    })
    const allowedStatuses = ref([])
    const selectedIds = reactive({
      status_id: null,
      priority_id: null,
      assigned_to_id: null,
    })

    const statusOptions = computed(() => {
      const allowed = allowedStatuses.value
      if (allowed.length > 0) {
        const currentStatus = props.ticket?.status_name
        const hasCurrent = currentStatus && allowed.some(s => s.name === currentStatus)
        if (currentStatus && !hasCurrent) {
          const fromAll = options.statuses.find(s => s.name === currentStatus)
          if (fromAll) {
            return [fromAll, ...allowed]
          }
          return [{ id: null, name: currentStatus }, ...allowed]
        }
        return allowed
      }
      return options.statuses
    })

    const form = reactive({
      subject: props.ticket?.subject || '',
      description: props.ticket?.description || '',
      status_name: props.ticket?.status_name || '',
      priority_name: props.ticket?.priority_name || '',
      assigned_to_name: props.ticket?.assigned_to_name || '',
      done_ratio: props.ticket?.done_ratio ?? null,
      notes: '',
    })

    async function loadTicketOptions() {
      try {
        const genRes = await fetch(`${API}/tickets/options`, { credentials: 'include' })
        const genData = await genRes.json()
        options.statuses = genData.statuses || []
        options.priorities = genData.priorities || []
        options.users = genData.users || []
      } catch (err) {
        console.error('Error al cargar opciones generales:', err)
      }

      const redmineId = props.ticket?.redmine_id
      if (!redmineId) return

      try {
        const res = await fetch(`${API}/tickets/ticket-options/${redmineId}`, { credentials: 'include' })
        const data = await res.json()
        if (data.statuses && data.statuses.length > 0) {
          allowedStatuses.value = data.statuses
        }
        if (data.priorities && data.priorities.length > 0) {
          options.priorities = data.priorities
        }
        if (data.users && data.users.length > 0) {
          options.users = data.users
        }
      } catch (err) {
        console.error('Error al cargar opciones del ticket:', err)
      }

      if (options.statuses.length === 0) {
        options.statuses = [
          { id: null, name: 'Nuevo' },
          { id: null, name: 'En Progreso' },
          { id: null, name: 'Resuelto' },
          { id: null, name: 'Feedback' },
          { id: null, name: 'Cerrado' },
          { id: null, name: 'Rechazado' },
        ]
      }
    }

    function onStatusChange() {
      const match = statusOptions.value.find(s => s.name === form.status_name)
      selectedIds.status_id = match ? match.id : null
    }

    function onPriorityChange() {
      const match = options.priorities.find(p => p.name === form.priority_name)
      selectedIds.priority_id = match ? match.id : null
    }

    function onUserChange() {
      const match = options.users.find(u => u.name === form.assigned_to_name)
      selectedIds.assigned_to_id = match ? match.id : null
    }

    function validate() {
      let valid = true
      errors.subject = ''

      if (!form.subject || !form.subject.trim()) {
        errors.subject = 'El asunto es requerido.'
        valid = false
      }

      return valid
    }

    async function save() {
      if (!validate()) return
      saving.value = true
      try {
        const payload = {
          subject: form.subject.trim(),
          description: form.description,
          status_name: form.status_name,
          priority_name: form.priority_name,
          assigned_to_name: form.assigned_to_name,
          status_id: selectedIds.status_id,
          priority_id: selectedIds.priority_id,
          assigned_to_id: selectedIds.assigned_to_id,
          done_ratio: form.done_ratio,
          notes: form.notes || undefined,
        }
        emit('confirm', payload)
      } catch (err) {
        console.error('Error en save:', err)
      } finally {
        saving.value = false
      }
    }

    function cancel() {
      emit('confirm', null)
    }

    onMounted(async () => {
      await loadTicketOptions()

      const statusMatch = statusOptions.value.find(s => s.name === form.status_name)
      if (statusMatch) selectedIds.status_id = statusMatch.id

      const priorityMatch = options.priorities.find(p => p.name === form.priority_name)
      if (priorityMatch) selectedIds.priority_id = priorityMatch.id

      const userMatch = options.users.find(u => u.name === form.assigned_to_name)
      if (userMatch) selectedIds.assigned_to_id = userMatch.id
    })

    return {
      form, options, allowedStatuses, statusOptions, errors, saving, selectedIds,
      save, cancel, onStatusChange, onPriorityChange, onUserChange,
    }
  },
}
</script>

<style scoped>
.ticket-edit-control {
  color: #e0e0e0;
  font-family: monospace;
  font-size: 0.875rem;
}

.ticket-header {
  display: flex;
  align-items: center;
  gap: 8px;
  flex-wrap: wrap;
}

.ticket-id {
  font-weight: bold;
  color: #75AADB;
  font-size: 1rem;
  white-space: nowrap;
}

.title-input {
  flex: 1;
  min-width: 200px;
  font-size: 1rem;
  font-weight: 600;
}

.ticket-field {
  margin-top: 10px;
  display: flex;
  flex-direction: column;
  gap: 2px;
}

.row-fields {
  flex-direction: row;
  gap: 12px;
}

.row-fields .field-item {
  flex: 1;
  display: flex;
  flex-direction: column;
  gap: 2px;
  min-width: 0;
}

.field-label {
  color: #9ca3af;
  font-size: 0.75rem;
  text-transform: uppercase;
  letter-spacing: 0.5px;
}

.field-value-readonly {
  color: #e0e0e0;
  padding: 4px 0;
}

.ticket-input {
  background: transparent;
  border: none;
  border-bottom: 1px solid #75AADB;
  color: #e0e0e0;
  padding: 4px 0;
  font-family: monospace;
  font-size: 0.875rem;
  outline: none;
  transition: border-color 0.15s ease;
}

.ticket-input:focus {
  border-bottom-color: #5a8fc0;
}

.ticket-input.is-invalid {
  border-bottom-color: #f87171;
}

.ticket-select {
  background: #1a2744;
  border: 1px solid #75AADB;
  border-radius: 4px;
  color: #e0e0e0;
  padding: 4px 8px;
  font-family: monospace;
  font-size: 0.875rem;
  outline: none;
  cursor: pointer;
  transition: border-color 0.15s ease;
}

.ticket-select:focus {
  border-color: #5a8fc0;
}

.done-ratio-wrapper {
  display: flex;
  align-items: center;
  gap: 8px;
}

.done-ratio-slider {
  flex: 1;
  min-width: 60px;
  accent-color: #75AADB;
  cursor: pointer;
}

.done-ratio-value {
  min-width: 36px;
  text-align: right;
  color: #e0e0e0;
  font-size: 0.875rem;
}

.ticket-select option {
  background: #1a2744;
  color: #e0e0e0;
}

.ticket-textarea {
  background: transparent;
  border: 1px solid #75AADB;
  border-radius: 4px;
  color: #e0e0e0;
  padding: 6px 8px;
  font-family: monospace;
  font-size: 0.875rem;
  outline: none;
  resize: vertical;
  transition: border-color 0.15s ease;
}

.ticket-textarea:focus {
  border-color: #5a8fc0;
}

.error-msg {
  color: #f87171;
  font-size: 0.75rem;
  margin-top: 2px;
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
</style>
