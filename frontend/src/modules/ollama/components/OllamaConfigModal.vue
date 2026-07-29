<template>
  <div class="d-flex flex-column">
    <p class="small mb-2" style="color: #75AADB;">{{ modelName }}</p>
    <div class="form-check">
      <input type="checkbox" id="chkCommitModel" v-model="commitEnabled" class="form-check-input" style="cursor: pointer;" />
      <label for="chkCommitModel" class="form-check-label small ms-1" style="font-size: 0.85rem; cursor: pointer;">Usar para commits</label>
    </div>
    <p class="small text-muted mt-1" style="font-size: 0.7rem;">Al activar esta opción, este modelo se usará para generar mensajes de commit en lugar de DeepSeek. Solo un modelo puede tener esta opción activa.</p>
    <div v-if="errorMsg" class="small text-danger mt-1" style="font-size: 0.75rem;">{{ errorMsg }}</div>
    <div class="d-flex justify-content-end mt-3 gap-2">
      <button class="btn btn-sm btn-secondary" @click="$emit('cancel')">Cancelar</button>
      <button class="btn btn-sm" style="background: rgba(117, 170, 219, 0.15); color: #75AADB; border: 1px solid rgba(117, 170, 219, 0.3);" :disabled="guardando" @click="guardar">{{ guardando ? 'Guardando...' : 'Guardar' }}</button>
    </div>
  </div>
</template>

<script>
export default {
  props: {
    modelName: { type: String, required: true },
    commitModelName: { type: String, default: '' },
  },
  emits: ['close', 'cancel'],
  data() {
    return {
      commitEnabled: this.commitModelName === this.modelName,
      guardando: false,
      errorMsg: '',
    }
  },
  methods: {
    async guardar() {
      this.guardando = true
      this.errorMsg = ''
      try {
        const newModel = this.commitEnabled ? this.modelName : ''
        const res = await fetch('/api/ollama/config', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          credentials: 'include',
          body: JSON.stringify({ commitModel: newModel }),
        })
        const data = await res.json()
        if (data.status) {
          this.$emit('close', { commitModel: newModel })
        } else {
          this.errorMsg = data.error || 'Error al guardar configuración'
        }
      } catch (err) {
        console.log('[OllamaConfigModal] Error:', err)
        this.errorMsg = 'Error de conexión con el servidor'
      } finally {
        this.guardando = false
      }
    },
  },
}
</script>
