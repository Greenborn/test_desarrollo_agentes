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
      <div style="min-width: 140px; flex: 1;">
        <label class="small text-light-emphasis mb-1">Modo</label>
        <div class="btn-group btn-group-sm w-100" role="group">
          <button
            type="button"
            class="btn btn-sm font-monospace"
            :class="selectedMode === 'Plan' ? 'btn-warning' : 'btn-outline-secondary'"
            @click="selectedMode = 'Plan'"
          >Plan</button>
          <button
            type="button"
            class="btn btn-sm font-monospace"
            :class="selectedMode === 'Build' ? 'btn-success' : 'btn-outline-secondary'"
            @click="selectedMode = 'Build'"
          >Build</button>
        </div>
      </div>
    </div>
    <textarea
      v-model="text"
      class="form-control form-control-sm bg-dark text-light border-secondary font-monospace"
      :rows="rows"
      :placeholder="placeholder"
    ></textarea>
    <button class="btn btn-sm btn-success align-self-end" :disabled="!text.trim() || !selectedModel" @click="confirm">
      Enviar a OpenCode
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
    modeValue: { type: String, default: 'Build' },
    placeholder: { type: String, default: '' },
    rows: { type: Number, default: 3 },
  },
  emits: ['confirm'],
  setup(props, { emit }) {
    const selectedModel = ref(props.modelValue || '')
    const selectedThinking = ref(props.thinkingValue || '')
    const selectedTemperature = ref(props.temperatureValue || '')
    const selectedMode = ref(props.modeValue || 'Build')
    const text = ref('')

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
      if (!text.value.trim() || !selectedModel.value) return
      emit('confirm', {
        model: selectedModel.value,
        thinking: showThinking.value ? selectedThinking.value : '',
        mode: selectedMode.value,
        temperature: selectedTemperature.value,
        prompt: text.value,
      })
    }

    return { selectedModel, selectedThinking, selectedTemperature, selectedMode, text, showThinking, onModelChange, confirm }
  },
}
</script>
