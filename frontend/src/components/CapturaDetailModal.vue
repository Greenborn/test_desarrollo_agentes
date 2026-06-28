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
      <div v-if="detectedInputs" class="d-flex align-items-center gap-2 mb-2">
        <div class="form-check form-switch mb-0">
          <input class="form-check-input" type="checkbox" role="switch" id="toggleOverlay" v-model="showOverlay" style="cursor: pointer;">
          <label class="form-check-label small text-muted" for="toggleOverlay" style="cursor: pointer;">Mostrar controles</label>
        </div>
        <span class="text-secondary" style="font-size: 0.65rem;">{{ detectedInputs.controls.length }} inputs detectados</span>
      </div>

      <div class="image-wrapper">
        <img ref="imageRef" :src="`/api/archivos/${captura.id}/download`" class="img-fluid rounded" style="max-width: 100%; max-height: 70vh; display: block;" @load="onImageLoad" />
        <div v-if="showOverlay && detectedInputs" class="overlay-layer">
          <div v-for="(ctrl, i) in detectedInputs.controls" :key="i"
               class="input-rect"
               :style="rectStyle(ctrl)"
               @mouseenter="hoveredControl = ctrl"
               @mouseleave="hoveredControl = null">
            <div v-if="hoveredControl === ctrl" class="input-tooltip">
              <div class="tooltip-header">{{ ctrl.tag }}{{ ctrl.type ? `[type="${ctrl.type}"]` : '' }}</div>
              <div v-if="ctrl.label" class="tooltip-row"><span class="tooltip-label">label:</span> {{ ctrl.label }}</div>
              <div v-if="ctrl.name" class="tooltip-row"><span class="tooltip-label">name:</span> {{ ctrl.name }}</div>
              <div v-if="ctrl.id" class="tooltip-row"><span class="tooltip-label">id:</span> {{ ctrl.id }}</div>
              <div v-if="ctrl.placeholder" class="tooltip-row"><span class="tooltip-label">placeholder:</span> {{ ctrl.placeholder }}</div>
              <div v-if="ctrl.value" class="tooltip-row"><span class="tooltip-label">value:</span> {{ ctrl.value }}</div>
              <div class="tooltip-row"><span class="tooltip-label">rect:</span> {{ formatRect(ctrl.rect) }}</div>
              <div class="tooltip-row text-secondary" style="font-size: 0.6rem;">{{ ctrl.visible ? 'visible' : 'oculto' }}{{ ctrl.disabled ? ', disabled' : '' }}{{ ctrl.required ? ', required' : '' }}</div>
            </div>
          </div>
        </div>
      </div>

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
            <pre class="mb-0"><code>{{ m.value }}</code></pre>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>

<script>
import { ref, computed, onMounted } from 'vue'

export default {
  props: {
    captura: { type: Object, required: true },
  },
  emits: ['close'],
  setup(props) {
    const activeTab = ref('captura')
    const metadata = ref([])
    const loadingMetadata = ref(false)
    const showOverlay = ref(false)
    const imageRef = ref(null)
    const hoveredControl = ref(null)
    const useDocumentRect = ref(false)

    const detectedInputs = computed(() => {
      const meta = metadata.value.find(m => m.key === 'detected_inputs')
      if (!meta) return null
      try {
        return JSON.parse(meta.value)
      } catch {
        return null
      }
    })

    function onImageLoad() {
      if (!imageRef.value || !detectedInputs.value) return
      const { viewportHeight, pageHeight } = detectedInputs.value
      const nh = imageRef.value.naturalHeight
      useDocumentRect.value = nh > viewportHeight * 1.2 && Math.abs(nh - pageHeight) < 50
    }

    function rectStyle(control) {
      const detected = detectedInputs.value
      if (!detected) return {}
      const r = useDocumentRect.value ? (control.documentRect || control.rect) : control.rect
      const refW = useDocumentRect.value ? detected.pageWidth : detected.viewportWidth
      const refH = useDocumentRect.value ? detected.pageHeight : detected.viewportHeight
      if (!refW || !refH) return {}
      return {
        left: `${(r.x / refW) * 100}%`,
        top: `${(r.y / refH) * 100}%`,
        width: `${(r.width / refW) * 100}%`,
        height: `${(r.height / refH) * 100}%`,
      }
    }

    function formatRect(rect) {
      if (!rect) return ''
      return `${Math.round(rect.x)},${Math.round(rect.y)} ${Math.round(rect.width)}×${Math.round(rect.height)}`
    }

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

    function formatDate(dateStr) {
      if (!dateStr) return ''
      const d = new Date(dateStr)
      return d.toLocaleString('es-AR', { timeZone: 'UTC', timeZoneName: 'short' })
    }

    onMounted(loadMetadata)

    return { activeTab, metadata, loadingMetadata, showOverlay, imageRef, hoveredControl, detectedInputs, onImageLoad, rectStyle, formatRect, eliminarMetadata, formatDate }
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

.image-wrapper {
  position: relative;
  display: inline-block;
  max-width: 100%;
}

.overlay-layer {
  position: absolute;
  top: 0;
  left: 0;
  width: 100%;
  height: 100%;
  pointer-events: none;
}

.input-rect {
  position: absolute;
  border: 2px solid rgba(117, 170, 219, 0.8);
  background: rgba(117, 170, 219, 0.1);
  border-radius: 3px;
  cursor: pointer;
  pointer-events: auto;
  transition: background 0.15s, border-color 0.15s;
}

.input-rect:hover {
  background: rgba(117, 170, 219, 0.25);
  border-color: #75AADB;
}

.input-tooltip {
  position: absolute;
  bottom: calc(100% + 6px);
  left: 50%;
  transform: translateX(-50%);
  background: #1a2744;
  border: 1px solid #374151;
  border-radius: 6px;
  padding: 6px 10px;
  white-space: nowrap;
  font-size: 0.7rem;
  line-height: 1.5;
  color: #cbd5e1;
  z-index: 10;
  pointer-events: none;
  box-shadow: 0 4px 12px rgba(0,0,0,0.5);
}

.tooltip-header {
  color: #75AADB;
  font-weight: 600;
  font-family: monospace;
  margin-bottom: 2px;
}

.tooltip-row {
  color: #cbd5e1;
}

.tooltip-label {
  color: #94a3b8;
  margin-right: 4px;
}

.form-check-input:checked {
  background-color: #75AADB;
  border-color: #75AADB;
}
</style>
