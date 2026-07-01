<template>
  <div class="descripcion-edit-control">
    <div class="mb-2" style="color: #9ca3af; font-size: 0.8rem;">
      Editando descripción del ticket #{{ ticketId }} — {{ ticketSubject }}
    </div>
    <textarea
      ref="textareaRef"
      v-model="text"
      class="form-control bg-dark text-light border-secondary font-monospace"
      placeholder="Escribe la descripción del ticket..."
      :rows="rows"
      style="resize: vertical;"
    ></textarea>
    <div class="d-flex flex-wrap gap-2 mt-2 justify-content-between">
      <div class="d-flex gap-2">
        <button class="btn btn-sm btn-argentina-outline" @click="abrirModal" :disabled="!text.trim()">
          🤖 Mejorar con IA
        </button>
        <button
          v-if="text !== originalDescription"
          class="btn btn-sm btn-outline-secondary"
          @click="deshacer"
          style="color: #9ca3af; border-color: #6c757d;"
        >
          ↩ Deshacer
        </button>
      </div>
      <div class="d-flex gap-2">
        <button class="btn btn-sm btn-argentina" @click="confirmar" :disabled="!text.trim()">
          Confirmar
        </button>
        <button class="btn btn-sm btn-outline-argentina" @click="cancelar">
          Cancelar
        </button>
      </div>
    </div>
  </div>
</template>

<script>
import { ref, onMounted } from 'vue'
import { useModalStore } from '../../stores/modal.js'
import DescripcionMejorarModal from './DescripcionMejorarModal.vue'

export default {
  props: {
    initialDescription: { type: String, default: '' },
    ticketSubject: { type: String, default: '' },
    ticketId: { type: [String, Number], default: '' },
    sessionId: { type: [String, Number], required: true },
    rows: { type: Number, default: 8 },
  },
  emits: ['confirm'],
  setup(props, { emit }) {
    const text = ref(props.initialDescription || '')
    const originalDescription = ref(props.initialDescription || '')
    const textareaRef = ref(null)

    function confirmar() {
      if (!text.value.trim()) return
      emit('confirm', { description: text.value.trim() })
    }

    function cancelar() {
      emit('confirm', null)
    }

    function deshacer() {
      text.value = originalDescription.value
    }

    function abrirModal() {
      const modal = useModalStore()
      modal.open(DescripcionMejorarModal, {
        sessionId: props.sessionId,
        ticketId: props.ticketId,
        onApply: (improved) => {
          text.value = improved
        },
      }, { title: props.ticketSubject ? `Mejorar: ${props.ticketSubject}` : 'Mejorar descripción con IA', wide: true })
    }

    onMounted(() => {
      if (textareaRef.value) textareaRef.value.focus()
    })

    return { text, textareaRef, confirmar, cancelar, deshacer, abrirModal, originalDescription }
  },
}
</script>

<style scoped>
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
