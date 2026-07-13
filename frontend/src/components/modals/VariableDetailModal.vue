<template>
  <div class="variable-detail">
    <div class="d-flex align-items-center justify-content-between mb-3">
      <div class="d-flex align-items-center gap-2">
        <h5 class="mb-0 text-light">{{ editKey }}</h5>
        <span v-if="variable.type === 'memory'" class="badge bg-info" style="font-size: 0.6rem;">mem</span>
        <span v-else class="badge bg-secondary" style="font-size: 0.6rem;">db</span>
      </div>
      <button v-if="!editMode" class="btn btn-sm btn-outline-primary" @click="enterEditMode">Editar</button>
    </div>

    <div v-if="!editMode">
      <div v-if="variable.created_at || variable.updated_at" class="mb-3 text-muted small">
        <div v-if="variable.created_at">Creada: {{ formatDate(variable.created_at) }}</div>
        <div v-if="variable.updated_at">Actualizada: {{ formatDate(variable.updated_at) }}</div>
      </div>
      <div class="mb-1 text-secondary small text-uppercase">Valor</div>
      <pre class="variable-value-box p-3 rounded mb-0"><code>{{ formattedValue }}</code></pre>
    </div>

    <div v-else>
      <div class="mb-3">
        <label class="text-secondary small text-uppercase mb-1">Key</label>
        <input v-model="editKey" class="form-control form-control-sm" placeholder="Nombre de la variable" />
      </div>
      <div class="mb-3">
        <label class="text-secondary small text-uppercase mb-1">Tipo</label>
        <select v-model="editType" class="form-select form-select-sm">
          <option value="db">db</option>
          <option value="memory">memory</option>
        </select>
      </div>
      <div class="mb-3">
        <label class="text-secondary small text-uppercase mb-1">Valor</label>
        <textarea v-model="editValue" class="form-control form-control-sm variable-textarea" rows="10"
          placeholder="Valor de la variable"></textarea>
      </div>

      <div class="d-flex gap-2">
        <button class="btn btn-sm btn-argentina" :disabled="saving" @click="guardar">
          {{ saving ? 'Guardando…' : 'Guardar' }}
        </button>
        <button class="btn btn-sm btn-outline-danger" :disabled="saving" @click="eliminar">
          Eliminar
        </button>
        <button class="btn btn-sm btn-outline-secondary" :disabled="saving" @click="cancelarEdit">
          Cancelar
        </button>
      </div>
      <div v-if="errorMsg" class="text-danger small mt-2">{{ errorMsg }}</div>
    </div>
  </div>
</template>

<script>
import { ref } from 'vue'
import { useProjectVariablesStore } from '../../stores/projectVariables.js'
import { useModalStore } from '../../stores/modal.js'

export default {
  props: {
    variable: { type: Object, required: true },
    proyectoId: { type: Number, default: null },
    modalId: { type: [Number, String], default: null },
  },
  setup(props) {
    const projectVariables = useProjectVariablesStore()
    const modal = useModalStore()

    const editMode = ref(false)
    const editKey = ref(props.variable.key)
    const editValue = ref(typeof props.variable.value === 'string' ? props.variable.value : JSON.stringify(props.variable.value, null, 2))
    const editType = ref(props.variable.type || 'db')
    const saving = ref(false)
    const errorMsg = ref('')

    function enterEditMode() {
      editKey.value = props.variable.key
      editValue.value = typeof props.variable.value === 'string' ? props.variable.value : JSON.stringify(props.variable.value, null, 2)
      editType.value = props.variable.type || 'db'
      errorMsg.value = ''
      editMode.value = true
    }

    function cancelarEdit() {
      editMode.value = false
      errorMsg.value = ''
    }

    async function guardar() {
      if (!editKey.value.trim()) {
        errorMsg.value = 'La key no puede estar vacía'
        return
      }
      saving.value = true
      errorMsg.value = ''
      try {
        await projectVariables.saveVariable(props.proyectoId, editKey.value.trim(), editValue.value, editType.value)
        if (props.modalId) modal.close(props.modalId)
      } catch (err) {
        errorMsg.value = err.message || 'Error al guardar la variable'
      } finally {
        saving.value = false
      }
    }

    async function eliminar() {
      saving.value = true
      errorMsg.value = ''
      try {
        await projectVariables.deleteVariable(props.proyectoId, props.variable.key)
        if (props.modalId) modal.close(props.modalId)
      } catch (err) {
        errorMsg.value = err.message || 'Error al eliminar la variable'
      } finally {
        saving.value = false
      }
    }

    return {
      editMode, editKey, editValue, editType, saving, errorMsg,
      enterEditMode, cancelarEdit, guardar, eliminar,
    }
  },
  computed: {
    formattedValue() {
      const v = this.variable.value
      if (!v) return '(vacío)'
      try {
        const parsed = typeof v === 'string' ? JSON.parse(v) : v
        return JSON.stringify(parsed, null, 2)
      } catch {
        return v
      }
    },
  },
  methods: {
    formatDate(dateStr) {
      if (!dateStr) return ''
      const d = new Date(dateStr)
      return d.toLocaleString('es-AR', { timeZone: 'UTC', timeZoneName: 'short' })
    },
  },
}
</script>

<style scoped>
.variable-detail {
  color: #cbd5e1;
}
.variable-value-box {
  background: #0d1117;
  border: 1px solid #30363d;
  max-height: 60vh;
  overflow-y: auto;
  font-size: 0.8rem;
  line-height: 1.5;
  white-space: pre-wrap;
  word-break: break-all;
}
code {
  color: #cbd5e1;
}
.variable-textarea {
  background: #0d1117;
  border: 1px solid #30363d;
  color: #cbd5e1;
  font-family: monospace;
  font-size: 0.8rem;
  resize: vertical;
}
.variable-textarea:focus {
  background: #0d1117;
  color: #cbd5e1;
  border-color: #75AADB;
  box-shadow: 0 0 0 0.15rem rgba(117, 170, 219, 0.25);
}
</style>
