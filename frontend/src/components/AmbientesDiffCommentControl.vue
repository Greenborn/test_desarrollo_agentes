<template>
  <div class="diff-comment-control">
    <div class="mb-2" style="color: #9ca3af; font-size: 0.8rem;">
      Propuesta de comentario sobre diferencias entre {{ sourceEnv }} y {{ targetEnv }}:
    </div>
    <textarea
      v-model="editedMessage"
      class="form-control bg-dark text-light border-secondary font-monospace p-3 mb-2 rounded-3"
      style="min-height: 150px; resize: vertical; font-size: 0.875rem;"
    ></textarea>
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
      <button class="btn btn-sm btn-outline-argentina" @click="cancelar">
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
    sourceEnv: { type: String, default: '' },
    targetEnv: { type: String, default: '' },
    modoEnvioInicial: { type: String, default: 'encolar' },
  },
  emits: ['confirm'],
  setup(props, { emit }) {
    const editedMessage = ref(props.message)
    const modoEnvio = ref(props.modoEnvioInicial || 'encolar')

    function confirmar() {
      if (!editedMessage.value.trim()) return
      emit('confirm', { action: 'confirm', message: editedMessage.value, modo_envio: modoEnvio.value })
    }

    function cancelar() {
      emit('confirm', null)
    }

    return { editedMessage, modoEnvio, confirmar, cancelar }
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
