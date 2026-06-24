<template>
  <div class="commit-result-control">
    <div class="mb-2" style="color: #9ca3af; font-size: 0.8rem;">Propuesta de commit:</div>
    <textarea
      v-model="editedMessage"
      class="form-control bg-dark text-light border-secondary font-monospace p-3 mb-2 rounded-3"
      style="min-height: 100px; resize: vertical; font-size: 0.875rem;"
    ></textarea>
    <label class="d-flex align-items-center gap-2 mb-2" style="color: #9ca3af; font-size: 0.8rem; cursor: pointer;">
      <input type="checkbox" v-model="addComment" class="form-check-input" style="cursor: pointer;" />
      Agregar comentario al ticket
    </label>
    <div class="d-flex align-items-center gap-2 mb-2">
      <label class="small text-light-emphasis mb-0" style="color: #9ca3af; font-size: 0.8rem;">Modo envío:</label>
      <select v-model="modoEnvio" class="form-select form-select-sm bg-dark text-light border-secondary font-monospace" style="width: auto;">
        <option value="encolar">Encolar</option>
        <option value="enviar">Enviar</option>
      </select>
    </div>
    <div class="d-flex gap-2">
      <button class="btn btn-sm btn-success" @click="confirmar">
        Confirmar
      </button>
      <button class="btn btn-sm btn-argentina" @click="reintentar" :disabled="loading">
        {{ loading ? 'Generando...' : 'Reintentar' }}
      </button>
      <button class="btn btn-sm btn-outline-argentina" @click="cancelar" :disabled="loading">
        Cancelar
      </button>
    </div>
  </div>
</template>

<script>
import { ref } from 'vue'

export default {
  props: {
    message: { type: String, required: true },
    loading: { type: Boolean, default: false },
    modoEnvioInicial: { type: String, default: 'encolar' },
  },
  emits: ['confirm'],
  setup(props, { emit }) {
    const editedMessage = ref(props.message)
    const addComment = ref(true)
    const modoEnvio = ref(props.modoEnvioInicial || 'encolar')

    function confirmar() {
      emit('confirm', { action: 'confirm', message: editedMessage.value, addComment: addComment.value, modo_envio: modoEnvio.value })
    }

    function reintentar() {
      emit('confirm', { action: 'retry' })
    }

    function cancelar() {
      emit('confirm', null)
    }

    return { editedMessage, addComment, modoEnvio, confirmar, reintentar, cancelar }
  },
}
</script>

<style scoped>
.btn-success {
  background-color: #22c55e;
  border: 1px solid #22c55e;
  color: #fff;
}
.btn-success:hover {
  background-color: #16a34a;
  border-color: #16a34a;
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
