<template>
  <div class="variable-detail">
    <div class="d-flex align-items-center gap-2 mb-3">
      <h5 class="mb-0 text-light">{{ variable.key }}</h5>
      <span v-if="variable.type === 'memory'" class="badge bg-info" style="font-size: 0.6rem;">mem</span>
      <span v-else class="badge bg-secondary" style="font-size: 0.6rem;">db</span>
    </div>

    <div v-if="variable.created_at || variable.updated_at" class="mb-3 text-muted small">
      <div v-if="variable.created_at">Creada: {{ formatDate(variable.created_at) }}</div>
      <div v-if="variable.updated_at">Actualizada: {{ formatDate(variable.updated_at) }}</div>
    </div>

    <div class="mb-1 text-secondary small text-uppercase">Valor</div>
    <pre class="variable-value-box p-3 rounded mb-0"><code>{{ formattedValue }}</code></pre>
  </div>
</template>

<script>
export default {
  props: {
    variable: { type: Object, required: true },
  },
  computed: {
    formattedValue() {
      const v = this.variable.value
      if (!v) return '(vacío)'
      try {
        const parsed = typeof v === 'string' ? JSON.parse(v) : v
        return JSON.stringify(parsed, null, 2)
      } catch {
        return v
      }
    },
  },
  methods: {
    formatDate(dateStr) {
      if (!dateStr) return ''
      const d = new Date(dateStr)
      return d.toLocaleString('es-AR', { timeZone: 'UTC', timeZoneName: 'short' })
    },
  },
}
</script>

<style scoped>
.variable-detail {
  color: #cbd5e1;
}
.variable-value-box {
  background: #0d1117;
  border: 1px solid #30363d;
  max-height: 60vh;
  overflow-y: auto;
  font-size: 0.8rem;
  line-height: 1.5;
  white-space: pre-wrap;
  word-break: break-all;
}
code {
  color: #cbd5e1;
}
</style>
