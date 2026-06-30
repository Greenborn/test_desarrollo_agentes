<template>
  <div class="d-flex flex-column gap-2">
    <textarea
      v-model="text"
      class="form-control form-control-sm bg-dark text-light border-secondary font-monospace"
      :rows="rows"
      :placeholder="placeholder || 'Escribe...'"
    ></textarea>
    <button class="btn btn-sm btn-success align-self-end" :disabled="!text.trim()" @click="confirm">
      Aceptar
    </button>
  </div>
</template>

<script>
import { ref } from 'vue'

export default {
  props: {
    modelValue: { type: String, default: '' },
    placeholder: { type: String, default: '' },
    rows: { type: Number, default: 3 },
  },
  emits: ['confirm', 'update:modelValue'],
  setup(props, { emit }) {
    const text = ref(props.modelValue || '')

    function confirm() {
      if (!text.value.trim()) return
      emit('update:modelValue', text.value)
      emit('confirm', text.value)
    }

    return { text, confirm }
  },
}
</script>
