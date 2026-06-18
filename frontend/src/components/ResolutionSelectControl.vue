<template>
  <div class="d-flex flex-column gap-2">
    <div class="fw-bold text-light">Resoluciones de Pantalla Registradas</div>
    <div class="small text-light-emphasis mb-2">Seleccione resolución por defecto</div>
    <div v-for="opt in options" :key="opt.value" class="form-check">
      <input
        type="radio"
        class="form-check-input"
        :id="'res-' + opt.value"
        :value="opt.value"
        v-model="selected"
      />
      <label class="form-check-label text-light" :for="'res-' + opt.value">
        {{ opt.label }}
      </label>
    </div>
    <button class="btn btn-sm btn-success align-self-end" :disabled="!selected" @click="confirm()">
      Establecer como predeterminada
    </button>
  </div>
</template>

<script>
import { ref } from 'vue'

export default {
  props: {
    options: { type: Array, required: true },
    preselect: { type: String, default: '' },
  },
  emits: ['confirm'],
  setup(props, { emit }) {
    const selected = ref(props.preselect || '')

    function confirm() {
      if (!selected.value) return
      emit('confirm', selected.value)
    }

    return { selected, confirm }
  },
}
</script>
