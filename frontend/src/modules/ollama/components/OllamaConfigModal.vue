<template>
  <div class="d-flex flex-column">
    <p class="small mb-2" style="color: #75AADB;">{{ modelName }}</p>

    <div v-if="otherModelActivo" class="small mb-2 px-2 py-1 rounded" style="background: rgba(239, 68, 68, 0.1); color: #ef4444;">
      Actualmente <strong>{{ commitModelName }}</strong> está configurado para commits.
    </div>

    <div class="form-check">
      <input type="checkbox" id="chkCommitModel" v-model="commitEnabled" class="form-check-input" style="cursor: pointer;" />
      <label for="chkCommitModel" class="form-check-label small ms-1" style="font-size: 0.85rem; cursor: pointer;">Usar para commits</label>
    </div>

    <p class="small text-muted mt-1" style="font-size: 0.7rem;">
      <template v-if="!otherModelActivo && !commitEnabled">
        Al activar esta opción, este modelo se usará para generar mensajes de commit en lugar de DeepSeek.
      </template>
      <template v-else-if="otherModelActivo && commitEnabled">
        Se desactivará {{ commitModelName }} y se usará este modelo en su lugar.
      </template>
      <template v-else-if="!otherModelActivo && commitEnabled">
        Este modelo está activo para commits. Se usará en lugar de DeepSeek.
      </template>
      <template v-else>
        Al activar esta opción, este modelo se usará para generar mensajes de commit en lugar de DeepSeek. Solo un modelo puede estar activo a la vez.
      </template>
    </p>

    <div v-if="errorMsg" class="small text-danger mt-1" style="font-size: 0.75rem;">{{ errorMsg }}</div>

    <div class="d-flex justify-content-end mt-3 gap-2">
      <button class="btn btn-sm btn-secondary" @click="$emit('cancel')">Cancelar</button>
      <button class="btn btn-sm" style="background: rgba(117, 170, 219, 0.15); color: #75AADB; border: 1px solid rgba(117, 170, 219, 0.3);" :disabled="guardando" @click="onGuardar">{{ guardando ? 'Guardando...' : 'Guardar' }}</button>
    </div>
  </div>
</template>

<script>
import ConfirmModal from '../../../components/modals/ConfirmModal.vue'
import { useModalStore } from '../../../stores/modal.js'

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
  computed: {
    otherModelActivo() {
      return this.commitModelName && this.commitModelName !== this.modelName
    },
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
    onGuardar() {
      if (this.otherModelActivo && this.commitEnabled) {
        const modal = useModalStore()
        modal.open(ConfirmModal, {
          message: 'El modelo "' + this.commitModelName + '" está actualmente configurado para commits.\n\n¿Deseas habilitar "' + this.modelName + '" en su lugar?',
          confirmLabel: 'Sí, usar este',
          confirmSeverity: 'btn-primary',
        }, {
          title: 'Cambiar modelo de commits',
          onClose: () => this.guardar(),
        })
      } else {
        this.guardar()
      }
    },
  },
}
</script>
