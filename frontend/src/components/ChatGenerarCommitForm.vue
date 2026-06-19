<template>
  <div class="d-flex flex-column gap-2">
    <div class="d-flex gap-2 flex-wrap">
      <div style="min-width: 180px; flex: 1;">
        <label class="small text-light-emphasis mb-1">Modelo</label>
        <select v-model="selectedModel" class="form-select form-select-sm bg-dark text-light border-secondary font-monospace" @change="onModelChange">
          <option value="" disabled>Selecciona modelo...</option>
          <option v-for="m in models" :key="m.value" :value="m.value">{{ m.label }}</option>
        </select>
      </div>
      <div v-if="showThinking" style="min-width: 160px; flex: 1;">
        <label class="small text-light-emphasis mb-1">Pensamiento</label>
        <select v-model="selectedThinking" class="form-select form-select-sm bg-dark text-light border-secondary font-monospace">
          <option v-for="t in thinkingOptions" :key="t.value" :value="t.value">{{ t.label }}</option>
        </select>
      </div>
      <div style="min-width: 140px; flex: 1;">
        <label class="small text-light-emphasis mb-1">Temperatura</label>
        <select v-model="selectedTemperature" class="form-select form-select-sm bg-dark text-light border-secondary font-monospace">
          <option v-for="t in temperatureOptions" :key="t.value" :value="t.value">{{ t.label }}</option>
        </select>
      </div>
    </div>
    <button class="btn btn-sm btn-success align-self-end" :disabled="!selectedModel" @click="confirm">
      Generar Commit
    </button>
  </div>
</template>

<script>
import { ref, computed } from 'vue'

export default {
  props: {
    models: { type: Array, default: () => [] },
    modelValue: { type: String, default: '' },
    thinkingOptions: { type: Array, default: () => [] },
    thinkingValue: { type: String, default: '' },
    temperatureOptions: { type: Array, default: () => [] },
    temperatureValue: { type: String, default: '' },
  },
  emits: ['confirm'],
  setup(props, { emit }) {
    const selectedModel = ref(props.modelValue || '')
    const selectedThinking = ref(props.thinkingValue || '')
    const selectedTemperature = ref(props.temperatureValue || '')

    const showThinking = computed(() => {
      if (!selectedModel.value) return false
      const m = props.models.find((o) => o.value === selectedModel.value)
      return m ? m.reasoning : false
    })

    function onModelChange() {
      if (!showThinking.value) {
        selectedThinking.value = ''
      }
    }

    function confirm() {
      if (!selectedModel.value) return
      emit('confirm', {
        model: selectedModel.value,
        thinking: showThinking.value ? selectedThinking.value : '',
        mode: 'Plan',
        temperature: selectedTemperature.value,
      })
    }

    return { selectedModel, selectedThinking, selectedTemperature, showThinking, onModelChange, confirm }
  },
}
</script>
