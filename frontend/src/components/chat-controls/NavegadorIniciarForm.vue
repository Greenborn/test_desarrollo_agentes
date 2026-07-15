<template>
  <div class="d-flex flex-column gap-2">
    <div class="fw-semibold mb-1" style="color: #e0e0e0; font-size: 0.9rem;">🌐 Iniciar Navegador Playwright</div>
    <div class="d-flex gap-2 flex-wrap">
      <div style="min-width: 140px; flex: 1;">
        <label class="small text-light-emphasis mb-1">Navegador <span class="text-danger">*</span></label>
        <select v-model="navegador" class="form-select form-select-sm bg-dark text-light border-secondary">
          <option value="chrome">Chrome</option>
          <option value="firefox">Firefox</option>
        </select>
      </div>
      <div style="min-width: 200px; flex: 2;">
        <label class="small text-light-emphasis mb-1">URL inicial (opcional)</label>
        <input v-model="url" type="url" class="form-control form-control-sm bg-dark text-light border-secondary" placeholder="https://ejemplo.com" />
      </div>
    </div>
    <div style="min-width: 160px; max-width: 300px;">
      <label class="small text-light-emphasis mb-1">Resolución (opcional)</label>
      <select v-model="resolutionId" class="form-select form-select-sm bg-dark text-light border-secondary">
        <option value="">Usar resolución por defecto</option>
        <option v-for="r in resolutions" :key="r.id" :value="r.id">{{ r.width }}x{{ r.height }} ({{ r.id }})</option>
      </select>
    </div>
    <div v-if="error" class="small" style="color: #ef4444;">{{ error }}</div>
    <div class="d-flex gap-2 justify-content-end mt-1">
      <button class="btn btn-sm btn-outline-argentina" @click="cancelar">Cancelar</button>
      <button class="btn btn-sm btn-success" :disabled="loading" @click="iniciar">
        {{ loading ? 'Iniciando...' : '🌐 Iniciar Navegador' }}
      </button>
    </div>
  </div>
</template>

<script>
import { ref, onMounted } from 'vue'

export default {
  emits: ['confirm'],
  props: {
    sessionId: { type: [String, Number], default: '' },
  },
  setup(props, { emit }) {
    const navegador = ref('chrome')
    const url = ref('')
    const resolutionId = ref('')
    const resolutions = ref([])
    const loading = ref(false)
    const error = ref('')

    onMounted(async () => {
      try {
        const res = await fetch('/api/settings', { credentials: 'include' })
        const data = await res.json()
        resolutions.value = data.screen_resolutions || []
      } catch (err) {
        console.error('Error al cargar resoluciones:', err)
      }
    })

    function iniciar() {
      if (loading.value) return
      loading.value = true
      error.value = ''
      emit('confirm', { navegador: navegador.value, url: url.value, resolutionId: resolutionId.value })
    }

    function cancelar() {
      emit('confirm', null)
    }

    return { navegador, url, resolutionId, resolutions, loading, error, iniciar, cancelar }
  },
}
</script>
