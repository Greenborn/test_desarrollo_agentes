<template>
  <div class="d-flex flex-column gap-2">
    <div class="d-flex gap-2 flex-wrap">
      <div style="min-width: 200px; flex: 1;">
        <label class="small text-light-emphasis mb-1">Modelo</label>
        <select v-model="selectedModel" class="form-select form-select-sm bg-dark text-light border-secondary font-monospace">
          <option v-for="m in models" :key="m.value" :value="m.value">{{ m.label }}</option>
        </select>
      </div>
      <div style="min-width: 160px; flex: 1;">
        <label class="small text-light-emphasis mb-1">Pensamiento</label>
        <select v-model="selectedThinking" class="form-select form-select-sm bg-dark text-light border-secondary font-monospace">
          <option v-for="t in thinkingOptions" :key="t.value" :value="t.value">{{ t.label }}</option>
        </select>
      </div>
    </div>
    <textarea
      v-model="text"
      class="form-control form-control-sm bg-dark text-light border-secondary font-monospace"
      :rows="rows"
      :placeholder="placeholder"
    ></textarea>
    <button class="btn btn-sm btn-success align-self-end" :disabled="!text.trim()" @click="confirm">
      Enviar a OpenCode
    </button>
  </div>
</template>

<script>
import { ref } from 'vue'

export default {
  props: {
    models: { type: Array, default: () => [] },
    modelValue: { type: String, default: '' },
    thinkingOptions: { type: Array, default: () => [] },
    thinkingValue: { type: String, default: '' },
    placeholder: { type: String, default: '' },
    rows: { type: Number, default: 3 },
  },
  emits: ['confirm'],
  setup(props, { emit }) {
    const selectedModel = ref(props.modelValue || '')
    const selectedThinking = ref(props.thinkingValue || '')
    const text = ref('')

    function confirm() {
      if (!text.value.trim()) return
      emit('confirm', {
        model: selectedModel.value,
        thinking: selectedThinking.value,
        prompt: text.value,
      })
    }

    return { selectedModel, selectedThinking, text, confirm }
  },
}
</script>
