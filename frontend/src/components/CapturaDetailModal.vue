<template>
  <div class="captura-detail d-flex flex-column" style="height: 100%;">
    <ul class="nav nav-tabs border-secondary mb-3">
      <li class="nav-item">
        <button class="nav-link" :class="{ active: activeTab === 'captura' }" @click="activeTab = 'captura'" style="font-size: 0.8rem; color: #cbd5e1; background: none; border: none; padding: 4px 12px; border-bottom: 2px solid transparent;">
          Captura
        </button>
      </li>
      <li class="nav-item">
        <button class="nav-link" :class="{ active: activeTab === 'metadata' }" @click="activeTab = 'metadata'" style="font-size: 0.8rem; color: #cbd5e1; background: none; border: none; padding: 4px 12px; border-bottom: 2px solid transparent;">
          Metadata ({{ metadata.length }})
        </button>
      </li>
    </ul>

    <div v-if="activeTab === 'captura'" class="captura-preview-tab d-flex flex-column align-items-center justify-content-start flex-grow-1 overflow-auto">
      <img :src="`/api/archivos/${captura.id}/download`" class="img-fluid rounded" style="max-width: 100%; max-height: 70vh;" />
      <div class="captura-info text-center mt-3 small">
        <div class="text-light">{{ captura.nombre_original }}</div>
        <div class="text-muted">{{ (captura.tamano / 1024).toFixed(1) }} KB — {{ formatDate(captura.created_at) }}</div>
      </div>
    </div>

    <div v-else class="metadata-tab flex-grow-1 overflow-auto">
      <div v-if="loadingMetadata" class="d-flex align-items-center justify-content-center text-secondary small py-4">
        <span>Cargando metadata…</span>
      </div>
      <div v-else-if="metadata.length === 0" class="d-flex align-items-center justify-content-center text-secondary small py-4">
        <span>Sin metadata</span>
      </div>
      <div v-else class="metadata-list">
        <div v-for="m in metadata" :key="m.id" class="metadata-item mb-2 p-2 rounded">
          <div class="d-flex align-items-center gap-2 mb-1">
            <span class="metadata-key small fw-semibold">{{ m.key }}</span>
            <span class="text-muted" style="font-size: 0.6rem;">{{ formatDate(m.created_at) }}</span>
            <button class="btn btn-sm btn-outline-danger ms-auto py-0 px-2" style="font-size: 0.6rem;" @click="eliminarMetadata(m)">✕</button>
          </div>
          <div class="metadata-value-box p-2 rounded">
            <pre class="mb-0"><code>{{ truncateValue(m.value) }}</code></pre>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>

<script>
import { ref, onMounted } from 'vue'

export default {
  props: {
    captura: { type: Object, required: true },
  },
  emits: ['close'],
  setup(props) {
    const activeTab = ref('captura')
    const metadata = ref([])
    const loadingMetadata = ref(false)

    async function loadMetadata() {
      loadingMetadata.value = true
      try {
        const res = await fetch(`/api/archivos/${props.captura.id}/metadata`, { credentials: 'include' })
        if (res.ok) {
          const data = await res.json()
          metadata.value = data.metadata || []
        }
      } catch (err) {
        console.error('Error al cargar metadata:', err)
      } finally {
        loadingMetadata.value = false
      }
    }

    async function eliminarMetadata(m) {
      if (!confirm(`¿Eliminar metadata "${m.key}"?`)) return
      try {
        const res = await fetch(`/api/archivos/${props.captura.id}/metadata/${m.id}`, {
          method: 'DELETE',
          credentials: 'include',
        })
        if (res.ok) {
          metadata.value = metadata.value.filter(x => x.id !== m.id)
        }
      } catch (err) {
        console.error('Error al eliminar metadata:', err)
      }
    }

    function truncateValue(val) {
      if (!val) return '(vacío)'
      if (val.length > 5000) return val.slice(0, 5000) + '…'
      return val
    }

    function formatDate(dateStr) {
      if (!dateStr) return ''
      const d = new Date(dateStr)
      return d.toLocaleString('es-AR', { timeZone: 'UTC', timeZoneName: 'short' })
    }

    onMounted(loadMetadata)

    return { activeTab, metadata, loadingMetadata, eliminarMetadata, truncateValue, formatDate }
  },
}
</script>

<style scoped>
.captura-detail {
  color: #cbd5e1;
}
.nav-tabs .nav-link.active {
  color: #75AADB !important;
  border-bottom-color: #75AADB !important;
}
.nav-tabs .nav-link:hover {
  color: #f8f9fa !important;
}
.metadata-item {
  background: #1a2744;
  border: 1px solid #374151;
}
.metadata-key {
  color: #75AADB;
  font-family: monospace;
}
.metadata-value-box {
  background: #0d1117;
  border: 1px solid #30363d;
  max-height: 300px;
  overflow-y: auto;
}
.metadata-value-box pre {
  font-size: 0.7rem;
  line-height: 1.4;
  white-space: pre-wrap;
  word-break: break-all;
}
.metadata-value-box code {
  color: #cbd5e1;
}
</style>
