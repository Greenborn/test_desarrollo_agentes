<template>
  <div class="descripcion-input-control">
    <div class="mb-2" style="color: #9ca3af; font-size: 0.8rem;">
      Describe qué tipo de descripción necesitas para el ticket:
    </div>
    <textarea
      ref="textareaRef"
      v-model="text"
      class="form-control bg-dark text-light border-secondary font-monospace"
      :placeholder="placeholder"
      :rows="rows"
      style="resize: vertical;"
    ></textarea>
    <div class="d-flex gap-2 mt-2">
      <button class="btn btn-sm btn-argentina" @click="redactar" :disabled="!text.trim()">
        Redactar
      </button>
      <button class="btn btn-sm btn-outline-argentina" @click="cancelar">
        Cancelar
      </button>
    </div>
  </div>
</template>

<script>
import { ref, onMounted } from 'vue'

export default {
  props: {
    placeholder: { type: String, default: 'Ej: Describe el error y los pasos para reproducirlo...' },
    rows: { type: Number, default: 3 },
  },
  emits: ['confirm'],
  setup(props, { emit }) {
    const text = ref('')
    const textareaRef = ref(null)

    function redactar() {
      if (!text.value.trim()) return
      emit('confirm', { text: text.value.trim() })
    }

    function cancelar() {
      emit('confirm', null)
    }

    onMounted(() => {
      if (textareaRef.value) textareaRef.value.focus()
    })

    return { text, textareaRef, redactar, cancelar }
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
