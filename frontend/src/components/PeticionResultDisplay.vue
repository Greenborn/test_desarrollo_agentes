<template>
  <div class="d-flex flex-column gap-2">
    <div
      class="d-flex align-items-center gap-2 px-2 py-1 rounded"
      :style="{ background: statusBg, color: statusFg }"
    >
      <strong class="font-monospace">{{ payload.status }} {{ payload.statusText }}</strong>
      <span class="small ms-auto">{{ payload.elapsed }}ms</span>
      <span v-if="payload.bodySize > 0" class="small">{{ (payload.bodySize / 1024).toFixed(1) }} KB</span>
      <span v-if="payload.truncated" class="badge bg-warning text-dark ms-1" title="La respuesta fue truncada porque excede el límite configurado.">Truncada</span>
    </div>

    <div v-if="payload.error" class="text-danger small">
      Error: {{ payload.error }}
    </div>

    <div v-if="hasHeaders" class="mt-1">
      <button
        class="btn btn-sm w-100 text-start btn-outline-argentina"
        data-bs-toggle="collapse"
        :data-bs-target="'#res-headers-' + uid"
      >
        Response Headers ({{ headerCount }})
      </button>
      <div class="collapse mt-1" :id="'res-headers-' + uid">
        <div class="d-flex flex-column gap-1">
          <div v-for="(val, key) in payload.headers" :key="key" class="d-flex gap-2 font-monospace small" style="word-break: break-all;">
            <span class="text-info" style="white-space: nowrap;">{{ key }}:</span>
            <span>{{ val }}</span>
          </div>
        </div>
      </div>
    </div>

    <div class="mt-1">
      <button
        class="btn btn-sm w-100 text-start btn-outline-argentina"
        data-bs-toggle="collapse"
        :data-bs-target="'#res-body-' + uid"
      >
        Response Body
        <span v-if="payload.truncated" class="text-warning ms-2">(truncado — mostraremos hasta el límite)</span>
        <span v-else-if="!payload.body" class="text-muted ms-2">(vacío)</span>
      </button>
      <div class="collapse show mt-1" :id="'res-body-' + uid">
        <pre class="mb-0 p-2 rounded font-monospace small" style="background: #0d1b3e; max-height: 400px; overflow: auto; white-space: pre-wrap; word-break: break-word;">{{ payload.body || '(sin contenido)' }}</pre>
        <div v-if="payload.truncated" class="text-warning small mt-1">
          ⚠️ La respuesta original pesaba {{ originalSizeKb }} KB, se truncó a {{ maxSizeKb }} KB.
        </div>
      </div>
    </div>
  </div>
</template>

<script>
import { computed } from 'vue'

let counter = 0

export default {
  props: {
    payload: { type: Object, required: true },
  },
  setup(props) {
    counter++
    const uid = 'pres-' + counter

    const statusBg = computed(() => {
      const s = props.payload.status
      if (s >= 200 && s < 300) return '#1a3a2a'
      if (s >= 300 && s < 400) return '#1a2a4a'
      if (s >= 400 && s < 500) return '#3a2a1a'
      if (s >= 500) return '#3a1a1a'
      return '#2a2a2a'
    })

    const statusFg = computed(() => {
      const s = props.payload.status
      if (s >= 200 && s < 300) return '#4ade80'
      if (s >= 300 && s < 400) return '#75AADB'
      if (s >= 400 && s < 500) return '#fbbf24'
      if (s >= 500) return '#ef4444'
      return '#9ca3af'
    })

    const hasHeaders = computed(() => {
      return Object.keys(props.payload.headers || {}).length > 0
    })

    const headerCount = computed(() => {
      return Object.keys(props.payload.headers || {}).length
    })

    const originalSizeKb = computed(() => {
      return ((props.payload.originalSize || props.payload.bodySize || 0) / 1024).toFixed(1)
    })

    const maxSizeKb = computed(() => {
      return (props.payload.bodySize / 1024).toFixed(1)
    })

    return { uid, statusBg, statusFg, hasHeaders, headerCount, originalSizeKb, maxSizeKb }
  },
}
</script>
