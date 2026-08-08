<template>
  <div class="rename-modal">
    <div v-if="error" class="alert alert-danger py-2 small mb-3">{{ error }}</div>

    <form @submit.prevent="submit" v-if="!submitting">
      <div class="mb-3">
        <label class="form-label small text-secondary text-uppercase">Nuevo nombre</label>
        <input
          ref="nameInput"
          v-model="name"
          type="text"
          class="form-control form-control-sm"
          placeholder="Nuevo nombre del archivo o carpeta"
          required
          :disabled="submitting"
          @keydown.esc="$emit('close')"
        />
        <div class="mt-2 small text-muted">
          Ruta: <code>{{ path }}</code>
        </div>
      </div>
      <div class="d-flex justify-content-end gap-2">
        <button type="button" class="btn btn-sm btn-outline-secondary" @click="$emit('close')" :disabled="submitting">Cancelar</button>
        <button type="submit" class="btn btn-sm btn-argentina" :disabled="submitting">
          <span v-if="submitting" class="spinner-border spinner-border-sm me-1" role="status"></span>
          {{ submitting ? 'Renombrando…' : 'Renombrar' }}
        </button>
      </div>
    </form>
    <div v-else class="text-center py-2">
      <button type="button" class="btn btn-sm btn-argentina" @click="$emit('close')">Cerrar</button>
    </div>
  </div>
</template>

<script>
import { ref, onMounted, nextTick } from 'vue'
import { useFileTreeStore } from '../../stores/fileTree.js'

export default {
  props: {
    path: { type: String, required: true },
    currentName: { type: String, required: true },
    sessionId: { type: Number, default: null },
  },
  emits: ['close'],
  setup(props) {
    const fileTreeStore = useFileTreeStore()
    const name = ref(props.currentName)
    const submitting = ref(false)
    const error = ref('')
    const nameInput = ref(null)

    onMounted(() => {
      nextTick(() => {
        if (nameInput.value) {
          nameInput.value.focus()
          nameInput.value.select()
        }
      })
    })

    async function submit() {
      const newName = name.value.trim()
      if (!newName) {
        error.value = 'El nombre no puede estar vacío.'
        return
      }
      if (newName === props.currentName) {
        error.value = 'El nuevo nombre es igual al actual.'
        return
      }

      error.value = ''
      submitting.value = true

      try {
        const res = await fetch('/api/command/rename', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          credentials: 'include',
          body: JSON.stringify({ path: props.path, newName }),
        })
        const data = await res.json()
        if (!data.success) {
          error.value = data.error || 'Error al renombrar.'
          submitting.value = false
          return
        }
        if (props.sessionId) {
          fileTreeStore.fetchTree(props.sessionId)
        }
        emit('close')
      } catch (err) {
        console.error('Error al renombrar:', err.message)
        error.value = `Error al renombrar: ${err.message}`
        submitting.value = false
      }
    }

    return { name, submitting, error, nameInput, submit }
  },
}
</script>

<style scoped>
.rename-modal {
  color: #cbd5e1;
}
.form-label {
  letter-spacing: 0.5px;
  margin-bottom: 4px;
}
.form-control {
  background: #0f172a;
  border: 1px solid #374151;
  color: #e2e8f0;
}
.form-control:focus {
  background: #0f172a;
  border-color: #75AADB;
  color: #e2e8f0;
  box-shadow: 0 0 0 0.15rem rgba(117, 170, 219, 0.25);
}
.form-control::placeholder {
  color: #6b7280;
}
.btn-argentina {
  background: #75AADB;
  border-color: #75AADB;
  color: #0f172a;
  font-weight: 600;
}
.btn-argentina:hover:not(:disabled) {
  background: #5a8fc0;
  border-color: #5a8fc0;
  color: #0f172a;
}
</style>