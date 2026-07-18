<template>
  <div class="crear-proyecto-control">
    <div class="header mb-3">
      <span class="title-label">Nuevo Proyecto en Redmine</span>
    </div>

    <div class="field mb-2">
      <span class="field-label">Espacio de trabajo:</span>
      <select v-model="form.workspace_id" class="form-select" @change="onWorkspaceChange">
        <option value="">Selecciona espacio de trabajo...</option>
        <option v-for="w in workspaces" :key="w.id" :value="w.id">{{ w.id }} — {{ w.name }}</option>
      </select>
      <div v-if="errors.workspace_id" class="error-msg">{{ errors.workspace_id }}</div>
    </div>

    <div class="field mb-2">
      <span class="field-label">Nombre del proyecto:</span>
      <input
        v-model="form.nombre"
        class="form-input"
        placeholder="Nombre del proyecto"
        :class="{ 'is-invalid': errors.nombre }"
        @input="onNombreChange"
      />
      <div v-if="errors.nombre" class="error-msg">{{ errors.nombre }}</div>
    </div>

    <div class="field mb-2">
      <span class="field-label">Identificador (slug):</span>
      <input
        v-model="form.identificador"
        class="form-input"
        placeholder="identificador_unico"
        :class="{ 'is-invalid': errors.identificador }"
      />
      <div v-if="errors.identificador" class="error-msg">{{ errors.identificador }}</div>
    </div>

    <div class="field mb-2">
      <span class="field-label">Descripción:</span>
      <textarea
        v-model="form.descripcion"
        class="form-textarea"
        rows="3"
        placeholder="Descripción del proyecto"
      ></textarea>
    </div>

    <div v-if="redmineOptions.trackers.length > 0" class="field mb-2">
      <span class="field-label">Trackers a habilitar:</span>
      <div class="trackers-grid">
        <label v-for="t in redmineOptions.trackers" :key="t.id" class="tracker-check">
          <input type="checkbox" :value="t.id" v-model="form.tracker_ids" class="form-check-input me-1" />
          {{ t.name }}
        </label>
      </div>
    </div>

    <div v-if="redmineOptions.priorities.length > 0" class="field mb-2">
      <span class="field-label">Prioridades disponibles:</span>
      <div class="priorities-list">
        <span v-for="p in redmineOptions.priorities" :key="p.id" class="priority-badge">{{ p.name }}</span>
      </div>
    </div>

    <div class="form-check form-switch mb-2">
      <input
        class="form-check-input"
        type="checkbox"
        role="switch"
        id="publicSwitch"
        v-model="form.is_public"
      />
      <label class="form-check-label small" for="publicSwitch">Proyecto público</label>
    </div>

    <div class="form-check form-switch mb-3">
      <input
        class="form-check-input"
        type="checkbox"
        role="switch"
        id="asignarSwitch"
        v-model="asignarASesion"
      />
      <label class="form-check-label small" for="asignarSwitch">Asignar a sesión actual</label>
    </div>

    <div class="d-flex gap-2 mt-3">
      <button class="btn btn-sm btn-argentina" @click="save" :disabled="saving">
        {{ saving ? 'Creando...' : 'Crear Proyecto' }}
      </button>
      <button class="btn btn-sm btn-outline-argentina" @click="cancel" :disabled="saving">
        Cancelar
      </button>
    </div>

    <div v-if="loadingOptions" class="mt-2 text-info small">Cargando opciones de Redmine...</div>
  </div>
</template>

<script>
import { ref, reactive, onMounted } from 'vue'

export default {
  props: {
    prefill: { type: Object, default: () => ({ nombre: '', descripcion: '', workspaceId: null }) },
  },
  emits: ['confirm'],
  setup(props, { emit }) {
    const saving = ref(false)
    const loadingOptions = ref(false)
    const workspaces = ref([])
    const redmineOptions = reactive({ trackers: [], priorities: [], statuses: [] })
    const errors = reactive({ nombre: '', identificador: '', workspace_id: '' })
    const asignarASesion = ref(true)

    function slugify(text) {
      return text.toLowerCase()
        .replace(/[^a-z0-9\s_-]/g, '')
        .replace(/[\s]+/g, '_')
        .replace(/-+/g, '_')
        .replace(/_+/g, '_')
        .replace(/^_|_$/g, '')
    }

    const form = reactive({
      workspace_id: props.prefill.workspaceId || '',
      nombre: props.prefill.nombre || '',
      identificador: '',
      descripcion: props.prefill.descripcion || '',
      tracker_ids: [],
      is_public: false,
    })

    function onNombreChange() {
      if (!form.identificador || form.identificador === slugify(form.nombre.replace(/[^a-z0-9\s_-]/g, '').replace(/[\s]+/g, '_'))) {
        form.identificador = slugify(form.nombre)
      }
      errors.nombre = ''
    }

    async function onWorkspaceChange() {
      errors.workspace_id = ''
      if (form.workspace_id) {
        await loadRedmineOptions()
      } else {
        redmineOptions.trackers = []
        redmineOptions.priorities = []
        redmineOptions.statuses = []
      }
    }

    async function loadWorkspaces() {
      try {
        const res = await fetch('/api/workspaces', { credentials: 'include' })
        const data = await res.json()
        workspaces.value = data.workspaces || []

        if (!form.workspace_id && workspaces.value.length === 1) {
          form.workspace_id = workspaces.value[0].id
          await loadRedmineOptions()
        }
      } catch (err) {
        console.error('Error al cargar workspaces:', err)
      }
    }

    async function loadRedmineOptions() {
      if (!form.workspace_id) return
      loadingOptions.value = true
      try {
        const res = await fetch('/api/redmine/proyectos/options?workspace_id=' + form.workspace_id, {
          credentials: 'include',
        })
        const data = await res.json()
        redmineOptions.trackers = data.trackers || []
        redmineOptions.priorities = data.priorities || []
        redmineOptions.statuses = data.statuses || []

        form.tracker_ids = redmineOptions.trackers.map(t => t.id)
      } catch (err) {
        console.error('Error al cargar opciones de Redmine:', err)
        redmineOptions.trackers = []
        redmineOptions.priorities = []
        redmineOptions.statuses = []
      } finally {
        loadingOptions.value = false
      }
    }

    function validate() {
      let valid = true
      errors.nombre = ''
      errors.identificador = ''
      errors.workspace_id = ''

      if (!form.nombre || !form.nombre.trim()) {
        errors.nombre = 'El nombre del proyecto es requerido.'
        valid = false
      }

      if (!form.identificador || !form.identificador.trim()) {
        errors.identificador = 'El identificador es requerido.'
        valid = false
      }

      if (!form.workspace_id) {
        errors.workspace_id = 'Debe seleccionar un espacio de trabajo.'
        valid = false
      }

      return valid
    }

    async function save() {
      if (!validate()) return
      saving.value = true
      try {
        const payload = {
          nombre: form.nombre.trim(),
          identificador: form.identificador.trim(),
          descripcion: form.descripcion,
          workspace_id: form.workspace_id,
          tracker_ids: form.tracker_ids,
          is_public: form.is_public,
          asignar_a_sesion: asignarASesion.value,
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
      await loadWorkspaces()
      if (form.nombre && !form.identificador) {
        form.identificador = slugify(form.nombre)
      }
      if (form.workspace_id) {
        await loadRedmineOptions()
      }
    })

    return {
      form, workspaces, redmineOptions, errors, saving, loadingOptions, asignarASesion,
      save, cancel, onNombreChange, onWorkspaceChange,
    }
  },
}
</script>

<style scoped>
.crear-proyecto-control {
  color: #e0e0e0;
  font-family: monospace;
  font-size: 0.875rem;
}

.header {
  display: flex;
  align-items: center;
  gap: 8px;
  flex-wrap: wrap;
}

.title-label {
  font-weight: bold;
  color: #75AADB;
  font-size: 1rem;
  white-space: nowrap;
}

.field {
  display: flex;
  flex-direction: column;
  gap: 2px;
}

.field-label {
  color: #9ca3af;
  font-size: 0.75rem;
  text-transform: uppercase;
  letter-spacing: 0.5px;
  margin-bottom: 2px;
}

.form-input {
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

.form-input:focus {
  border-bottom-color: #5a8fc0;
}

.form-input.is-invalid {
  border-bottom-color: #f87171;
}

.form-select {
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

.form-select:focus {
  border-color: #5a8fc0;
}

.form-select option {
  background: #1a2744;
  color: #e0e0e0;
}

.form-textarea {
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

.form-textarea:focus {
  border-color: #5a8fc0;
}

.trackers-grid {
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
}

.tracker-check {
  display: flex;
  align-items: center;
  gap: 4px;
  color: #e0e0e0;
  font-size: 0.875rem;
  cursor: pointer;
}

.priorities-list {
  display: flex;
  flex-wrap: wrap;
  gap: 6px;
}

.priority-badge {
  background: #1a2744;
  border: 1px solid #4b5563;
  border-radius: 4px;
  padding: 2px 8px;
  color: #9ca3af;
  font-size: 0.8rem;
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
