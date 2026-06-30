<template>
  <div class="d-flex flex-column gap-2">
    <div v-if="question" class="small text-light-emphasis mb-1">{{ question }}</div>
    <div class="d-flex gap-2 flex-wrap">
      <button
        v-for="opt in options"
        :key="opt.value"
        class="btn btn-sm"
        :class="opt.value === 'yes' || opt.value === 'accept' || opt.value === 'allow' ? 'btn-success' : opt.value === 'no' || opt.value === 'reject' || opt.value === 'deny' ? 'btn-danger' : 'btn-outline-light'"
        @click="confirm(opt.value)"
      >
        {{ opt.label }}
      </button>
    </div>
  </div>
</template>

<script>
export default {
  props: {
    options: { type: Array, required: true },
    question: { type: String, default: '' },
  },
  emits: ['confirm'],
  setup(props, { emit }) {
    function confirm(value) {
      emit('confirm', value)
    }
    return { confirm }
  },
}
</script>
