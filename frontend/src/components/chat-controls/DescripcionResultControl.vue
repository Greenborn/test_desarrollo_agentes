<template>
  <div class="descripcion-result-control">
    <div class="mb-2" style="color: #9ca3af; font-size: 0.8rem;">Descripción generada:</div>
    <div class="result-text p-3 mb-2 rounded-3" style="background: #0f1a2e; border: 1px solid #374151; color: #e0e0e0; white-space: pre-wrap; word-break: break-word; font-size: 0.875rem;">
      {{ description }}
    </div>
    <div class="d-flex gap-2">
      <button class="btn btn-sm btn-success" @click="aceptar">
        Aceptar
      </button>
      <button class="btn btn-sm btn-argentina" @click="reintentar" :disabled="loading">
        {{ loading ? 'Generando...' : 'Reintentar' }}
      </button>
      <button class="btn btn-sm btn-outline-argentina" @click="cancelar" :disabled="loading">
        Cancelar
      </button>
    </div>
  </div>
</template>

<script>
export default {
  props: {
    description: { type: String, required: true },
    loading: { type: Boolean, default: false },
  },
  emits: ['confirm'],
  setup(props, { emit }) {
    function aceptar() {
      emit('confirm', { action: 'accept', description: props.description })
    }

    function reintentar() {
      emit('confirm', { action: 'retry' })
    }

    function cancelar() {
      emit('confirm', null)
    }

    return { aceptar, reintentar, cancelar }
  },
}
</script>

<style scoped>
.btn-success {
  background-color: #22c55e;
  border: 1px solid #22c55e;
  color: #fff;
}
.btn-success:hover {
  background-color: #16a34a;
  border-color: #16a34a;
}
.btn-argentina {
  background-color: #75AADB;
  color: #fff;
  border: 1px solid #75AADB;
}
.btn-argentina:hover {
  background-color: #5a8fc0;
  color: #fff;
}
.btn-argentina:disabled {
  opacity: 0.6;
}
.btn-outline-argentina {
  background-color: transparent;
  color: #75AADB;
  border: 1px solid #75AADB;
}
.btn-outline-argentina:hover {
  background-color: #1a2744;
  color: #75AADB;
}
</style>
