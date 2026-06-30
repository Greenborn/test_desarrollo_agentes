<template>
  <div class="create-variable-modal">
    <div v-if="error" class="alert alert-danger py-2 small mb-3">{{ error }}</div>
    <div v-if="success" class="alert alert-success py-2 small mb-3">{{ success }}</div>

    <form @submit.prevent="submit" v-if="!submitting && !success">
      <div class="mb-3">
        <label class="form-label small text-secondary text-uppercase">Key</label>
        <input
          v-model="form.key"
          type="text"
          class="form-control form-control-sm"
          placeholder="ej: MI_VARIABLE"
          required
          :disabled="submitting"
        />
      </div>
      <div class="mb-3">
        <label class="form-label small text-secondary text-uppercase">Valor</label>
        <textarea
          v-model="form.value"
          class="form-control form-control-sm"
          rows="4"
          placeholder="Valor de la variable"
          required
          :disabled="submitting"
        ></textarea>
      </div>
      <div class="mb-3">
        <label class="form-label small text-secondary text-uppercase">Tipo</label>
        <select v-model="form.type" class="form-select form-select-sm" :disabled="submitting">
          <option value="db">db — persistente en BD</option>
          <option value="memory">memory — solo en memoria</option>
        </select>
      </div>
      <div class="d-flex justify-content-end gap-2">
        <button type="button" class="btn btn-sm btn-outline-secondary" @click="$emit('close')" :disabled="submitting">Cancelar</button>
        <button type="submit" class="btn btn-sm btn-argentina" :disabled="submitting">
          <span v-if="submitting" class="spinner-border spinner-border-sm me-1" role="status"></span>
          {{ submitting ? 'Creando…' : 'Crear Variable' }}
        </button>
      </div>
    </form>
    <div v-else-if="success" class="text-center">
      <button type="button" class="btn btn-sm btn-argentina mt-2" @click="$emit('close')">Cerrar</button>
    </div>
  </div>
</template>

<script>
import { ref, reactive } from 'vue'
import { useChatStore } from '../../stores/chat.js'
import { useCommandRegistry } from '../../composables/useCommandRegistry.js'

export default {
  emits: ['close'],
  setup() {
    const chat = useChatStore()
    const { find } = useCommandRegistry()

    const form = reactive({
      key: '',
      value: '',
      type: 'db',
    })
    const submitting = ref(false)
    const error = ref('')
    const success = ref('')

    async function submit() {
      if (!form.key.trim()) {
        error.value = 'El campo Key es obligatorio.'
        return
      }
      if (!form.value.trim()) {
        error.value = 'El campo Valor es obligatorio.'
        return
      }

      error.value = ''
      submitting.value = true

      const cmd = find('/proyecto_var_crear')
      if (!cmd) {
        error.value = 'Error interno: comando /proyecto_var_crear no encontrado.'
        submitting.value = false
        return
      }

      const args = [
        `--key=${form.key.trim()}`,
        `--value=${form.value.trim()}`,
        `--type=${form.type}`,
      ]
      const raw = `/proyecto_var_crear --key=${form.key.trim()} --value=${form.value.trim()} --type=${form.type}`

      try {
        await chat.runCommand(raw, async (loadingIdx, sessionId) => {
          return cmd.execute(args, { chatStore: chat, sessionId })
        })
        success.value = `Variable "${form.key.trim()}" creada correctamente.`
      } catch (err) {
        error.value = err.message || 'Error al crear la variable.'
      } finally {
        submitting.value = false
      }
    }

    return { form, submitting, error, success, submit }
  },
}
</script>

<style scoped>
.create-variable-modal {
  color: #cbd5e1;
}
.form-label {
  letter-spacing: 0.5px;
  margin-bottom: 4px;
}
.form-control, .form-select {
  background: #0f172a;
  border: 1px solid #374151;
  color: #e2e8f0;
}
.form-control:focus, .form-select:focus {
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
