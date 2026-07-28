<template>
  <div class="d-flex flex-column" style="min-height: 80px;">
    <div class="flex-grow-1" style="white-space: pre-wrap;">
      {{ message }}
    </div>
    <div class="d-flex justify-content-end mt-3 gap-2">
      <button class="btn btn-sm btn-secondary" @click="$emit('cancel')">Cancelar</button>
      <button :class="['btn', 'btn-sm', confirmSeverity]" @click="$emit('close')">{{ confirmLabel }}</button>
    </div>
  </div>
</template>

<script>
export default {
  props: {
    message: { type: String, required: true },
    confirmLabel: { type: String, default: 'Confirmar' },
    confirmSeverity: { type: String, default: 'btn-danger' },
  },
  emits: ['close', 'cancel'],
}
</script>
