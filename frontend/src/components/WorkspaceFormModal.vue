<template>
  <div class="d-flex flex-column gap-3">
    <div class="mb-2">
      <label class="form-label text-light small mb-1">Nombre</label>
      <input
        type="text"
        class="form-control bg-dark text-light border-secondary"
        v-model="formName"
        ref="nameInput"
        placeholder="Nombre del espacio de trabajo"
        @keyup.enter="save"
      />
    </div>

    <div>
      <label class="form-label text-light small mb-1">Color identificatorio</label>
      <div class="d-flex align-items-center gap-3">
        <input type="color" v-model="formColor" class="form-control form-control-color bg-dark border-secondary p-1" style="width: 50px; height: 38px;" />
        <span class="small text-muted font-monospace">{{ formColor }}</span>
      </div>
    </div>

    <div>
      <label class="form-label text-light small mb-1">Vista previa</label>
      <div>
        <span
          class="workspace-preview-badge"
          :style="previewStyle"
        >{{ formName || 'Nombre' }}</span>
      </div>
    </div>

    <div v-if="error" class="text-danger small">{{ error }}</div>

    <div class="d-flex gap-2 mt-2">
      <button class="btn btn-argentina flex-grow-1" :disabled="saving || !formName.trim()" @click="save">
        {{ saving ? 'Guardando...' : (isEdit ? 'Guardar cambios' : 'Crear espacio de trabajo') }}
      </button>
      <button class="btn btn-outline-secondary" @click="$emit('close')" :disabled="saving">Cancelar</button>
    </div>
  </div>
</template>

<script>
import { ref, computed, onMounted } from 'vue'
import { useWorkspaceStore } from '../stores/workspace.js'
import { contrastTextColor } from '../utils/color.js'

export default {
  props: {
    workspace: {
      type: Object,
      default: null,
    },
  },
  emits: ['close'],
  setup(props, { emit }) {
    const wsStore = useWorkspaceStore()
    const nameInput = ref(null)
    const formName = ref('')
    const formColor = ref('#75AADB')
    const saving = ref(false)
    const error = ref('')

    const isEdit = computed(() => !!props.workspace)

    const previewStyle = computed(() => ({
      backgroundColor: formColor.value,
      color: contrastTextColor(formColor.value),
    }))

    onMounted(() => {
      if (props.workspace) {
        formName.value = props.workspace.name || ''
        formColor.value = props.workspace.color || '#75AADB'
      }
      nameInput.value?.focus()
    })

    async function save() {
      const name = formName.value.trim()
      if (!name) {
        error.value = 'El nombre es requerido'
        return
      }
      saving.value = true
      error.value = ''
      try {
        let result
        if (isEdit.value) {
          result = await wsStore.updateWorkspace(props.workspace.id, name, formColor.value)
        } else {
          result = await wsStore.createWorkspace(name, formColor.value)
        }
        if (result.success) {
          emit('close')
        } else {
          error.value = result.error || 'Error al guardar'
        }
      } catch (err) {
        error.value = err.message
      } finally {
        saving.value = false
      }
    }

    return { formName, formColor, nameInput, saving, error, isEdit, previewStyle, save }
  },
}
</script>

<style scoped>
.workspace-preview-badge {
  display: inline-block;
  font-size: 0.75rem;
  font-weight: 600;
  padding: 2px 8px;
  border-radius: 4px;
  line-height: 1.5;
}
</style>
