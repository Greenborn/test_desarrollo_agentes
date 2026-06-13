<template>
  <div class="mb-3" :class="msg.role === 'user' ? 'text-end' : 'text-start'">
    <div
      class="d-inline-block rounded-3 p-3 text-start"
      :class="msg.role === 'user' ? 'bg-primary text-white' : 'bg-light border'"
      style="max-width: 80%;"
    >
      <div v-if="msg.thinking" class="mb-2">
        <button
          class="btn btn-sm btn-outline-secondary w-100 text-start"
          data-bs-toggle="collapse"
          :data-bs-target="'#think-' + uid"
        >
          🧠 Razonamiento interno
        </button>
        <div class="collapse mt-1" :id="'think-' + uid">
          <pre class="mb-0 small text-muted" style="white-space: pre-wrap;">{{ msg.thinking }}</pre>
        </div>
      </div>
      <div style="white-space: pre-wrap;">{{ msg.content }}</div>
    </div>
  </div>
</template>

<script>
let counter = 0

export default {
  props: {
    msg: { type: Object, required: true },
  },
  computed: {
    uid() {
      counter++
      return 'cm-' + counter
    },
  },
}
</script>
