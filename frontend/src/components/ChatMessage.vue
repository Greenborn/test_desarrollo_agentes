<template>
  <div class="mb-3" :class="msg.role === 'user' ? 'text-end' : 'text-start'">
    <div v-if="msg.role === 'command'" class="d-inline-block rounded-3 p-2 text-start font-monospace" style="max-width: 90%; background: #1a1a2e; border: 1px solid #00ff88; color: #00ff88;">
      <span class="me-2" style="color: #666;">$</span>{{ msg.content }}
    </div>
    <div v-else-if="msg.role === 'result'" class="d-inline-block rounded-3 p-2 text-start font-monospace small" style="max-width: 90%; background: #16213e; border: 1px solid #0f3460; color: #e0e0e0;">
      <pre class="mb-0" style="white-space: pre-wrap;">{{ msg.content }}</pre>
    </div>
    <div
      v-else
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
