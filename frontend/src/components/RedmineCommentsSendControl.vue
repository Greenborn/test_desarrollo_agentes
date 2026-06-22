<template>
  <div class="d-flex flex-column gap-2">
    <div style="color: #9ca3af; font-size: 0.8rem;">
      Vista previa del mensaje a enviar ({{ cantidad }} comentario{{ cantidad !== 1 ? 's' : '' }} al ticket #{{ ticket_redmine_id }}):
    </div>
    <textarea
      v-model="text"
      class="form-control form-control-sm bg-dark text-light border-secondary font-monospace"
      rows="8"
      style="white-space: pre-wrap;"
    ></textarea>
    <div class="d-flex gap-2 justify-content-end">
      <button class="btn btn-sm btn-success" @click="confirmar">
        Confirmar
      </button>
      <button class="btn btn-sm btn-outline-argentina" @click="cancelar">
        Cancelar
      </button>
    </div>
  </div>
</template>

<script>
import { ref } from 'vue'

export default {
  props: {
    comentarios_ids: { type: Array, required: true },
    ticket_redmine_id: { type: Number, required: true },
    mensaje: { type: String, default: '' },
    cantidad: { type: Number, default: 0 },
  },
  emits: ['confirm'],
  setup(props, { emit }) {
    const text = ref(props.mensaje || '')

    function confirmar() {
      if (!text.value.trim()) return
      emit('confirm', {
        mensaje: text.value.trim(),
        comentarios_ids: props.comentarios_ids,
        ticket_redmine_id: props.ticket_redmine_id,
      })
    }

    function cancelar() {
      emit('confirm', null)
    }

    return { text, confirmar, cancelar }
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
