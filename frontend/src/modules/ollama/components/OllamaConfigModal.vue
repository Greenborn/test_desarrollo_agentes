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
      <button class="btn btn-sm btn-secondary" @click="cancelar">Cancelar</button>
      <button class="btn btn-sm" style="background: rgba(117, 170, 219, 0.15); color: #75AADB; border: 1px solid rgba(117, 170, 219, 0.3);" :disabled="guardando" @click="onGuardar">{{ guardando ? 'Guardando...' : 'Guardar' }}</button>
    </div>
  </div>
</template>

<script>
import { useModal } from 'vue-greenborn-modal-manager'

export default {
  props: {
    parametros: { type: Object, default: () => ({}) },
  },
  setup(props) {
    const { ocultar_modal, mostrar_confirm } = useModal()
    const parametros = props.parametros

    return { ocultar_modal, mostrar_confirm, parametros }
  },
  data() {
    return {
      modelName: this.parametros.modelName || '',
      commitModelName: this.parametros.commitModelName || '',
      commitEnabled: this.parametros.commitModelName === this.parametros.modelName,
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
          if (this.parametros._modalState && this.parametros._modalState.resolve) {
            this.parametros._modalState.resolve({ commitModel: newModel })
          }
          this.ocultar_modal(this.parametros._modal_cod)
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
    cancelar() {
      if (this.parametros._modalState && this.parametros._modalState.resolve) {
        this.parametros._modalState.resolve(null)
      }
      this.ocultar_modal(this.parametros._modal_cod)
    },
    onGuardar() {
      if (this.otherModelActivo && this.commitEnabled) {
        this.mostrar_confirm({
          title: 'Cambiar modelo de commits',
          text: 'El modelo "' + this.commitModelName + '" está actualmente configurado para commits.\n\n¿Deseas habilitar "' + this.modelName + '" en su lugar?',
          severity_confirmar: 'primary',
          confirmar_accion: () => this.guardar(),
        })
      } else {
        this.guardar()
      }
    },
  },
}
</script>
