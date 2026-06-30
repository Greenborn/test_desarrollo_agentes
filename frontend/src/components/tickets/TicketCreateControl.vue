<template>
  <div class="ticket-create-control">
    <div class="ticket-header mb-3">
      <span class="ticket-label">Nuevo Ticket</span>
      <div class="form-check form-switch mb-0 ms-auto">
        <input
          class="form-check-input"
          type="checkbox"
          role="switch"
          id="autoAssignSwitch"
          v-model="autoAssign"
        />
        <label class="form-check-label small" for="autoAssignSwitch">Asignar a sesión</label>
      </div>
      <div class="form-check form-switch mb-0 ms-2">
        <input
          class="form-check-input"
          type="checkbox"
          role="switch"
          id="createBranchSwitch"
          v-model="createBranch"
        />
        <label class="form-check-label small" for="createBranchSwitch">Crear rama Git</label>
      </div>
    </div>

    <div class="ticket-field mb-2">
      <span class="field-label">Proyecto:</span>
      <select v-model="form.project_id" class="ticket-select" @change="onProjectChange">
        <option value="">Selecciona proyecto...</option>
        <option v-for="p in flattenedProjects" :key="p.id" :value="p.id">{{ p.indent }}{{ p.id }} — {{ p.label }}</option>
      </select>
      <div v-if="errors.project_id" class="error-msg">{{ errors.project_id }}</div>
    </div>

    <div class="ticket-header mb-3">
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
        <span class="field-label">Tipo:</span>
        <select v-model="form.tracker_name" class="ticket-select" @change="onTrackerChange">
          <option value="" disabled>Selecciona tipo...</option>
          <option v-for="t in options.trackers" :key="t.id || t.name" :value="t.name">{{ t.name }}</option>
        </select>
      </div>
      <div class="field-item">
        <span class="field-label">Estado:</span>
        <select v-model="form.status_name" class="ticket-select" @change="onStatusChange">
          <option value="" disabled>Selecciona estado...</option>
          <option v-for="s in options.statuses" :key="s.id || s.name" :value="s.name">{{ s.name }}</option>
        </select>
      </div>
      <div class="field-item">
        <span class="field-label">Prioridad:</span>
        <select v-model="form.priority_name" class="ticket-select" @change="onPriorityChange">
          <option value="" disabled>Selecciona prioridad...</option>
          <option v-for="p in options.priorities" :key="p.id || p.name" :value="p.name">{{ p.name }}</option>
        </select>
      </div>
      <div class="field-item">
        <span class="field-label">Asignado a:</span>
        <select v-model="form.assigned_to_name" class="ticket-select" @change="onUserChange">
          <option value="">— Sin asignar —</option>
          <option v-for="u in options.users" :key="u.id" :value="u.name">{{ u.name }}</option>
        </select>
      </div>
      <div class="field-item">
        <span class="field-label">% Avance:</span>
        <div class="done-ratio-wrapper">
          <input type="range" min="0" max="100" step="1" v-model.number="form.done_ratio" class="done-ratio-slider" />
          <span class="done-ratio-value">{{ form.done_ratio ?? 0 }}%</span>
        </div>
      </div>
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

    <div class="d-flex gap-2 mt-3">
      <button class="btn btn-sm btn-argentina" @click="save" :disabled="saving">
        {{ saving ? 'Creando...' : 'Crear Ticket' }}
      </button>
      <button class="btn btn-sm btn-outline-argentina" @click="cancel" :disabled="saving">
        Cancelar
      </button>
    </div>
  </div>
</template>

<script>
import { ref, reactive, computed, onMounted } from 'vue'
import { useTicketFormStore } from '../../stores/ticketForm.js'

export default {
  props: {
    projectId: { type: String, default: '' },
  },
  emits: ['confirm'],
  setup(props, { emit }) {
    const ticketFormStore = useTicketFormStore()
    const saving = ref(false)
    const errors = reactive({ subject: '', project_id: '' })
    const autoAssign = ref(true)
    const createBranch = ref(true)
    const allProjects = ref([])
    const options = ticketFormStore.options
    const selectedIds = reactive({
      status_id: null,
      priority_id: null,
      tracker_id: null,
      assigned_to_id: null,
    })

    const form = reactive({
      project_id: '',
      subject: '',
      description: '',
      status_name: '',
      priority_name: '',
      tracker_name: '',
      assigned_to_name: '',
      done_ratio: 0,
    })

    const projectTree = computed(() => {
      const withRedmine = allProjects.value.filter(p => p.redmine_id != null)
      const map = {}
      const roots = []
      for (const p of withRedmine) {
        map[p.redmine_id] = { ...p, children: [] }
      }
      for (const p of withRedmine) {
        if (p.redmine_parent_id && map[p.redmine_parent_id]) {
          map[p.redmine_parent_id].children.push(map[p.redmine_id])
        } else {
          roots.push(map[p.redmine_id])
        }
      }
      return roots
    })

    const flattenedProjects = computed(() => {
      const result = []
      function walk(nodes, depth) {
        for (const node of nodes) {
          result.push({
            id: node.id,
            label: node.descripcion?.slice(0, 60),
            indent: '\u00A0\u00A0'.repeat(depth) + (depth > 0 ? '\u21B3 ' : ''),
          })
          if (node.children.length > 0) {
            walk(node.children, depth + 1)
          }
        }
      }
      walk(projectTree.value, 0)
      return result
    })

    async function loadProjects() {
      try {
        const res = await fetch('/api/proyecto', { credentials: 'include' })
        const data = await res.json()
        allProjects.value = data.proyectos || []
      } catch (err) {
        console.error('Error al cargar proyectos:', err)
      }
    }

    async function loadOptions() {
      await ticketFormStore.loadOptions()
    }

    function onProjectChange() {
      const project = allProjects.value.find(p => p.id === form.project_id)
      if (!project) return
      form.project_id = project.id
      form.assigned_to_name = ''
      selectedIds.assigned_to_id = null
      loadProjectUsers(project.id)
    }

    async function loadProjectUsers(projectId) {
      await ticketFormStore.loadProjectUsers(projectId)
    }

    function onPriorityChange() {
      const match = options.priorities.find(p => p.name === form.priority_name)
      selectedIds.priority_id = match ? match.id : null
    }

    function onStatusChange() {
      const match = options.statuses.find(s => s.name === form.status_name)
      selectedIds.status_id = match ? match.id : null
    }

    function onTrackerChange() {
      const match = options.trackers.find(t => t.name === form.tracker_name)
      selectedIds.tracker_id = match ? match.id : null
    }

    function onUserChange() {
      const match = options.users.find(u => u.name === form.assigned_to_name)
      selectedIds.assigned_to_id = match ? match.id : null
    }

    function validate() {
      let valid = true
      errors.subject = ''
      errors.project_id = ''

      if (!form.subject || !form.subject.trim()) {
        errors.subject = 'El asunto es requerido.'
        valid = false
      }

      if (!form.project_id) {
        errors.project_id = 'Debe seleccionar un proyecto.'
        valid = false
      }

      return valid
    }

    async function save() {
      if (!validate()) return
      saving.value = true
      try {
        const payload = {
          project_id: form.project_id,
          subject: form.subject.trim(),
          description: form.description,
          status_name: form.status_name || undefined,
          priority_name: form.priority_name || undefined,
          tracker_name: form.tracker_name || undefined,
          assigned_to_name: form.assigned_to_name || undefined,
          status_id: selectedIds.status_id,
          priority_id: selectedIds.priority_id,
          tracker_id: selectedIds.tracker_id,
          assigned_to_id: selectedIds.assigned_to_id,
          done_ratio: form.done_ratio,
          autoAssign: autoAssign.value,
          createBranch: createBranch.value,
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
      await loadProjects()
      await loadOptions()
      if (props.projectId) {
        form.project_id = props.projectId
      }
      if (form.project_id) {
        await loadProjectUsers(form.project_id)
      }
    })

    return {
      form, options, allProjects, flattenedProjects, errors, saving, selectedIds, autoAssign, createBranch,
      save, cancel, onProjectChange, onPriorityChange, onStatusChange, onTrackerChange, onUserChange, loadProjectUsers,
    }
  },
}
</script>

<style scoped>
.ticket-create-control {
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

.ticket-label {
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

.form-check-input {
  background-color: #374151;
  border-color: #75AADB;
  cursor: pointer;
}

.form-check-input:checked {
  background-color: #75AADB;
  border-color: #75AADB;
}

.form-check-label {
  color: #9ca3af;
  font-size: 0.75rem;
  cursor: pointer;
}
</style>
