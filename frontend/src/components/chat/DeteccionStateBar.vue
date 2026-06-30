<template>
  <div v-if="deteccionState.running" class="border-top p-2" style="border-color: #75AADB; background: #0d1b2a;">
    <div class="d-flex align-items-center gap-2">
      <div class="flex-grow-1 small text-truncate" style="color: #e0e0e0;">
        📄 {{ deteccionState.processed + 1 }}/{{ deteccionState.total }}: {{ deteccionState.current }}
      </div>
      <button class="btn btn-sm btn-outline-danger flex-shrink-0" @click="$emit('abort')">⏹ Detener</button>
    </div>
  </div>
</template>

<script>
export default {
  props: {
    deteccionState: { type: Object, required: true },
  },
  emits: ['abort'],
}
</script>
