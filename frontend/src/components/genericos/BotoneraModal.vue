<template>
  <div class="d-flex justify-content-end gap-2 px-3 py-2 border-top">
    <button v-for="btn in buttons" :key="btn.label"
      :class="['btn', 'btn-sm', btn.severity || 'btn-secondary']"
      :disabled="btn.disabled"
      @click="btn.onClick">
      <i v-if="btn.icon" :class="btn.icon + ' me-1'"></i>
      {{ btn.label }}
    </button>
  </div>
</template>

<script>
export default {
  props: {
    buttons: { type: Array, default: () => [] },
  },
}
</script>
