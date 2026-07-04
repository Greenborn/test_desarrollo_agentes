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
      <div style="min-width: 180px; flex: 1;" class="d-flex align-items-end pb-1">
        <div class="form-check form-switch d-flex align-items-center gap-2 mb-0">
          <input
            class="form-check-input"
            type="checkbox"
            role="switch"
            id="useTicketDesc"
            v-model="useTicketDesc"
            :disabled="loadingDesc"
          >
          <label class="form-check-label small text-light-emphasis" for="useTicketDesc">
            Usar descripción del ticket
            <span v-if="loadingDesc" class="spinner-border spinner-border-sm ms-1" role="status"></span>
          </label>
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
import { ref, computed, watch } from 'vue'

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
    prefill: { type: String, default: '' },
    sessionId: { type: String, default: '' },
  },
  emits: ['confirm'],
  setup(props, { emit }) {
    const selectedModel = ref(props.modelValue || '')
    const selectedThinking = ref(props.thinkingValue || '')
    const selectedTemperature = ref(props.temperatureValue || '')
    const selectedMode = ref(props.modeValue || 'Build')
    const text = ref(props.prefill || '')
    const useTicketDesc = ref(!!props.prefill)
    const loadingDesc = ref(false)

    const showThinking = computed(() => {
      if (!selectedModel.value) return false
      const m = props.models.find((o) => o.value === selectedModel.value)
      return m ? m.reasoning : false
    })

    const previousText = ref('')

    watch(useTicketDesc, async (enabled) => {
      if (enabled) {
        if (!props.sessionId) {
          text.value = '*(No hay sesión activa para obtener el ticket)*'
          return
        }
        previousText.value = text.value
        loadingDesc.value = true
        try {
          const res = await fetch(`/api/tickets/session/${props.sessionId}`, { credentials: 'include' })
          const data = await res.json()
          if (data.ticket && data.ticket.description) {
            text.value = data.ticket.description
          } else if (data.idTicketRedmine) {
            text.value = '*(El ticket asignado no tiene descripción)*'
          } else {
            text.value = '*(No hay ticket asignado a esta sesión)*'
          }
        } catch (err) {
          console.error('Error al obtener descripción del ticket:', err.message)
          text.value = '*(Error al obtener la descripción del ticket)*'
        } finally {
          loadingDesc.value = false
        }
      } else {
        text.value = previousText.value
      }
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

    return { selectedModel, selectedThinking, selectedTemperature, selectedMode, text, showThinking, onModelChange, confirm, useTicketDesc, loadingDesc }
  },
}
</script>
