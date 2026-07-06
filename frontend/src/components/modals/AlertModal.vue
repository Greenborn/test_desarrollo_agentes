<template>
  <div class="alert-modal d-flex flex-column" style="min-height: 80px;">
    <div class="alert-modal-message flex-grow-1" style="white-space: pre-wrap;">
      {{ message }}
    </div>
    <div class="d-flex justify-content-end mt-3">
      <button class="btn btn-argentina btn-sm" @click="$emit('close')">OK</button>
    </div>
  </div>
</template>

<script>
export default {
  props: {
    message: { type: String, required: true },
  },
  emits: ['close'],
}
</script>
