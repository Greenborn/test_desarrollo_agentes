<template>
  <div class="mb-3" :class="msg.role === 'user' ? 'text-end' : 'text-start'">
    <div v-if="msg.role === 'command'" class="d-inline-block rounded-3 p-2 text-start font-monospace" style="max-width: 90%; background: #1a1a2e; border: 1px solid #00ff88; color: #00ff88;">
      {{ msg.content }}
    </div>
    <div v-else-if="msg.role === 'result'" class="d-inline-block rounded-3 p-2 text-start font-monospace small" style="max-width: 90%; background: #16213e; border: 1px solid #0f3460; color: #e0e0e0;">
      <pre class="mb-0" style="white-space: pre-wrap;">{{ msg.content }}</pre>
    </div>
    <div v-else-if="msg.role === 'opencode_control'" class="d-inline-block rounded-3 p-3 text-start" style="max-width: 90%; background: #1a1a2e; border: 1px solid #7c3aed; color: #e0e0e0;">
      <ControlSelect v-if="parsedControl && parsedControl.controlType === 'select'" :options="parsedControl.options || []" :preselect="parsedControl.preselect || ''" :placeholder="parsedControl.placeholder || 'Selecciona...'" @confirm="(val) => $emit('control-confirm', { controlId: parsedControl.controlId, value: val })" />
      <ControlTextarea v-else-if="parsedControl && parsedControl.controlType === 'textarea'" :placeholder="parsedControl.placeholder || 'Escribe...'" :rows="parsedControl.rows || 3" @confirm="(val) => $emit('control-confirm', { controlId: parsedControl.controlId, value: val })" />
      <div v-else class="d-flex flex-column gap-2">
        <pre class="mb-0 small" style="white-space: pre-wrap;">{{ msg.content }}</pre>
      </div>
    </div>
    <div v-else-if="msg.role === 'opencode_confirmed'" class="d-inline-block rounded-3 p-2 text-start font-monospace small" style="max-width: 90%; background: #1a1a2e; border: 1px solid #7c3aed; color: #c4b5fd;">
      {{ msg.content }}
    </div>
    <div v-else-if="msg.role === 'opencode_stream'" class="d-inline-block rounded-3 p-3 text-start" style="max-width: 90%; background: #0f0f1e; border: 1px solid #7c3aed; color: #f0f0f0;">
      <div v-if="msg.thinking" class="mb-2">
        <button class="btn btn-sm btn-outline-secondary w-100 text-start" data-bs-toggle="collapse" :data-bs-target="'#think-' + uid">
          🧠 Razonando...
        </button>
        <div class="collapse show mt-1" :id="'think-' + uid">
          <pre class="mb-0 small text-muted" style="white-space: pre-wrap;">{{ msg.thinking }}</pre>
        </div>
      </div>
      <div style="white-space: pre-wrap;">{{ msg.content }}<span v-if="msg.streaming" class="blink">▌</span></div>
    </div>
    <div v-else-if="msg.role === 'opencode_result'" class="d-inline-block rounded-3 p-3 text-start font-monospace small" style="max-width: 90%; background: #0f0f1e; border: 1px solid #7c3aed; color: #f0f0f0;">
      <div style="white-space: pre-wrap;">{{ msg.content }}</div>
      <div v-if="msg.extra && msg.extra.hash" class="mt-2 small" style="color: #87ceeb;">Hash: {{ msg.extra.hash }}</div>
    </div>
    <div v-else-if="msg.role === 'opencode_info'" class="d-inline-block rounded-3 p-2 text-start small" style="max-width: 90%; background: #1a1a2e; border: 1px solid #374151; color: #9ca3af;">
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
import ControlSelect from './ChatControlSelect.vue'
import ControlTextarea from './ChatControlTextarea.vue'

let counter = 0

export default {
  components: { ControlSelect, ControlTextarea },
  props: {
    msg: { type: Object, required: true },
  },
  emits: ['control-confirm'],
  computed: {
    uid() {
      counter++
      return 'cm-' + counter
    },
    parsedControl() {
      try {
        return this.msg.controlData || (typeof this.msg.content === 'string' ? JSON.parse(this.msg.content) : this.msg.content)
      } catch {
        return null
      }
    },
    parsedResult() {
      try {
        const data = typeof this.msg.content === 'string' ? JSON.parse(this.msg.content) : this.msg.content
        if (data && data.type === 'opencode_result') return data
        return data
      } catch {
        return null
      }
    },
  },
}
</script>

<style scoped>
.blink {
  animation: blink 1s step-end infinite;
}
@keyframes blink {
  50% { opacity: 0; }
}
</style>
