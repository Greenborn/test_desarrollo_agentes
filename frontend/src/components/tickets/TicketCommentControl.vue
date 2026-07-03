<template>
  <div class="ticket-comment-control">
    <div class="mb-2" style="color: #9ca3af; font-size: 0.8rem;">
      Nuevo comentario para el ticket #{{ ticketId }}:
    </div>
    <textarea
      v-model="commentText"
      class="form-control bg-dark text-light border-secondary font-monospace p-3 mb-2 rounded-3"
      style="min-height: 100px; resize: vertical; font-size: 0.875rem;"
      placeholder="Escribí tu comentario..."
    ></textarea>
    <div class="d-flex align-items-center gap-2 mb-2">
      <label class="small text-light-emphasis mb-0" style="color: #9ca3af; font-size: 0.8rem;">Modo envío:</label>
      <select v-model="modoEnvio" class="form-select form-select-sm bg-dark text-light border-secondary font-monospace" style="width: auto;">
        <option value="encolar">Encolar</option>
        <option value="enviar">Enviar</option>
      </select>
    </div>
    <div class="d-flex gap-2">
      <button class="btn btn-sm btn-argentina-outline" @click="abrirModal" :disabled="!commentText.trim()">
        🤖 Mejorar con IA
      </button>
      <button class="btn btn-sm btn-success" @click="confirmar" :disabled="!commentText.trim()">
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
import { useModalStore } from '../../stores/modal.js'
import DescripcionMejorarModal from '../chat-controls/DescripcionMejorarModal.vue'

export default {
  props: {
    ticketId: { type: [Number, String], required: true },
    sessionId: { type: [String, Number], default: '' },
    modoEnvioInicial: { type: String, default: 'encolar' },
  },
  emits: ['confirm'],
  setup(props, { emit }) {
    const commentText = ref('')
    const modoEnvio = ref(props.modoEnvioInicial || 'encolar')

    function confirmar() {
      if (!commentText.value.trim()) return
      emit('confirm', { action: 'confirm', message: commentText.value, modo_envio: modoEnvio.value })
    }

    function cancelar() {
      emit('confirm', null)
    }

    function abrirModal() {
      const modal = useModalStore()
      modal.open(DescripcionMejorarModal, {
        sessionId: props.sessionId,
        ticketId: props.ticketId,
        onApply: (improved) => {
          commentText.value = improved
        },
      }, { title: 'Mejorar comentario con IA', wide: true })
    }

    return { commentText, modoEnvio, confirmar, cancelar, abrirModal }
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
.btn-success:disabled {
  opacity: 0.5;
}
.btn-argentina-outline {
  background-color: transparent;
  color: #75AADB;
  border: 1px solid #75AADB;
}
.btn-argentina-outline:hover {
  background-color: #1a2744;
  color: #75AADB;
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
