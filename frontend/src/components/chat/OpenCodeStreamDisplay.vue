<template>
  <div v-if="streaming" class="text-start mb-3">
    <div class="d-inline-block rounded-3 p-3 text-start" style="max-width: 80%; background: #1a2744; border: 1px solid #374151; color: #e0e0e0;">
      <div v-if="currentThinking" class="mb-2">
        <button class="btn btn-sm w-100 text-start btn-outline-argentina" data-bs-toggle="collapse" data-bs-target="#think-stream">
          🧠 Razonando...
        </button>
        <div class="collapse show mt-1" id="think-stream">
          <pre class="mb-0 small text-muted" style="white-space: pre-wrap;">{{ currentThinking }}</pre>
        </div>
      </div>
      <div style="white-space: pre-wrap;">{{ currentChunk }}<span class="blink">▌</span></div>
    </div>
  </div>
</template>

<script>
export default {
  props: {
    currentThinking: { type: String, default: '' },
    currentChunk: { type: String, default: '' },
    streaming: { type: Boolean, default: false },
  },
}
</script>
