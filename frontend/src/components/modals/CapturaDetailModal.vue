<template>
  <div class="captura-detail d-flex" style="height: 100%; width: 100%;">
    <!-- Left column -->
    <div class="left-col d-flex flex-column" :style="{ width: leftWidth + 'px', minWidth: '300px' }">
      <ul class="nav nav-tabs border-secondary mb-2">
        <li class="nav-item">
          <button class="nav-link" :class="{ active: activeTab === 'captura' }" @click="activeTab = 'captura'" style="font-size: 0.8rem; color: #cbd5e1; background: none; border: none; padding: 4px 12px; border-bottom: 2px solid transparent;">
            Captura
          </button>
        </li>
        <li class="nav-item">
          <button class="nav-link" :class="{ active: activeTab === 'metadata' }" @click="activeTab = 'metadata'" style="font-size: 0.8rem; color: #cbd5e1; background: none; border: none; padding: 4px 12px; border-bottom: 2px solid transparent;">
            Metadata ({{ filteredMetadata.length }})
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
          <img ref="imageRef" :src="`/api/archivos/${captura.id}/download`" class="img-fluid rounded" style="max-width: 100%; max-height: 60vh; display: block;" @load="onImageLoad" />
          <div v-if="showOverlay && detectedInputs" class="overlay-layer">
            <div v-for="(ctrl, i) in detectedInputs.controls" :key="i"
                 class="input-rect"
                 :class="{ 'rect-selection': selectionMode }"
                 :style="rectStyle(ctrl, i)"
                 @mouseenter="onRectHover(i)"
                 @mouseleave="onRectLeave"
                 @click="onRectClick(i)">
              <div v-if="hoveredControlIndex === i && !selectionMode" class="input-tooltip">
                <div class="tooltip-header">{{ ctrl.tag }}{{ ctrl.type ? `[type="${ctrl.type}"]` : '' }}</div>
                <div v-if="ctrl.label" class="tooltip-row"><span class="tooltip-label">label:</span> {{ ctrl.label }}</div>
                <div v-if="ctrl.name" class="tooltip-row"><span class="tooltip-label">name:</span> {{ ctrl.name }}</div>
                <div v-if="ctrl.id" class="tooltip-row"><span class="tooltip-label">id:</span> {{ ctrl.id }}</div>
                <div v-if="ctrl.placeholder" class="tooltip-row"><span class="tooltip-label">placeholder:</span> {{ ctrl.placeholder }}</div>
                <div v-if="ctrl.value" class="tooltip-row"><span class="tooltip-label">value:</span> {{ ctrl.value }}</div>
                <div class="tooltip-row"><span class="tooltip-label">rect:</span> {{ formatRect(ctrl.rect) }}</div>
                <div class="tooltip-row text-secondary" style="font-size: 0.6rem;">{{ ctrl.visible ? 'visible' : 'oculto' }}{{ ctrl.disabled ? ', disabled' : '' }}{{ ctrl.required ? ', required' : '' }}</div>
              </div>
              <div v-if="selectionMode" class="selection-badge">{{ i + 1 }}</div>
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
        <div v-else-if="filteredMetadata.length === 0" class="d-flex align-items-center justify-content-center text-secondary small py-4">
          <span>Sin metadata</span>
        </div>
        <div v-else class="metadata-list">
          <div v-for="m in filteredMetadata" :key="m.id" class="metadata-item mb-2 p-2 rounded">
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

    <!-- Splitter -->
    <div class="splitter" @mousedown="onSplitterStart"></div>

    <!-- Right column — Quick notes -->
    <div class="right-col d-flex flex-column" :style="{ width: rightWidth + 'px', minWidth: '250px' }">
      <div class="right-header d-flex align-items-center justify-content-between px-2 py-1">
        <span class="small fw-semibold text-light">Notas rápidas</span>
        <span class="text-secondary" style="font-size: 0.7rem;">{{ notes.length }}</span>
      </div>

      <div class="notes-list flex-grow-1 overflow-auto px-2">
        <div v-if="notes.length === 0" class="d-flex align-items-center justify-content-center text-secondary small py-4">
          <span>Sin notas</span>
        </div>
        <div v-for="(note, ni) in notes" :key="note.id" class="note-item mb-2 p-2 rounded"
             @mouseenter="onNoteHover(ni)"
             @mouseleave="onNoteLeave">
          <div class="d-flex align-items-start gap-1 mb-1">
            <div class="note-badge-area" style="min-width: 0;">
              <div v-if="note.controlIndex != null && detectedInputs" class="note-badge small"
                   :class="{ 'badge-highlight': highlightedNoteIndex === ni }"
                   @mouseenter="highlightedControlIndex = note.controlIndex"
                   @mouseleave="highlightedControlIndex = null"
                   @click="onViewControlClick(ni)"
                   style="cursor: pointer;">
                {{ badgeLabel(note.controlIndex) }}
              </div>
              <div v-else class="note-badge-general small">
                general
              </div>
            </div>
            <button class="btn btn-sm btn-outline-danger ms-auto py-0 px-1" style="font-size: 0.6rem; line-height: 1;" @click="deleteNote(ni)">✕</button>
          </div>
          <div class="note-text small mb-1">{{ note.text }}</div>
          <div class="d-flex align-items-center gap-1">
            <div v-if="note.controlIndex == null" class="dropdown" ref="dropdownRefs" :data-note-index="ni">
              <button class="btn btn-sm btn-outline-secondary py-0 px-1 dropdown-toggle" style="font-size: 0.65rem;" type="button" data-bs-toggle="dropdown" aria-expanded="false" @click="onOpenDropdown(ni)">
                Asignar control
              </button>
              <ul class="dropdown-menu" style="font-size: 0.7rem; max-height: 200px; overflow-y: auto; background: #1a2744; border-color: #374151;"
                  @mouseover="onDropdownHover($event)"
                  @mouseleave="highlightedControlIndex = null">
                <li v-for="(ctrl, ci) in (detectedInputs ? detectedInputs.controls : [])" :key="ci"
                    class="dropdown-item"
                    :data-ci="ci"
                    style="color: #cbd5e1; cursor: pointer; padding: 2px 8px;"
                    @click="assignControl(ni, ci)">
                  {{ ci + 1 }}. {{ ctrl.tag }}{{ ctrl.type ? `[${ctrl.type}]` : '' }} — {{ ctrl.label || ctrl.name || ctrl.id || ctrl.placeholder || 'sin label' }}
                </li>
                <li v-if="!detectedInputs || detectedInputs.controls.length === 0" class="dropdown-item disabled" style="color: #6b7280; padding: 2px 8px;">
                  Sin controles detectados
                </li>
              </ul>
            </div>
            <div v-else>
              <button class="btn btn-sm btn-outline-info py-0 px-1" style="font-size: 0.65rem;" @click="onViewControlClick(ni)">
                Ver en imagen
              </button>
            </div>
            <span class="text-secondary ms-auto" style="font-size: 0.55rem;">{{ formatTime(note.createdAt) }}</span>
          </div>
        </div>
      </div>

      <div class="note-input-area px-2 py-2">
        <textarea v-model="noteText" class="form-control form-control-sm" rows="2" placeholder="Escribir nota..." style="font-size: 0.75rem; background: #0d1117; color: #cbd5e1; border-color: #374151; resize: none;"></textarea>
        <button class="btn btn-sm btn-outline-light mt-1 w-100" style="font-size: 0.7rem;" @click="addNote" :disabled="!noteText.trim()">Agregar nota</button>
      </div>
    </div>
  </div>
</template>

<script>
import { ref, computed, onMounted } from 'vue'
import { settingSet, settingGet } from '../services/settingService.js'

function generateId() {
  return Date.now().toString(36) + Math.random().toString(36).slice(2, 8)
}

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
    const useDocumentRect = ref(false)
    const hoveredControlIndex = ref(null)
    const highlightedControlIndex = ref(null)
    const selectionMode = ref(false)
    const pendingNoteIndex = ref(null)
    const notes = ref([])
    const noteText = ref('')
    const highlightedNoteIndex = ref(null)
    const dropdownRefs = ref([])

    const leftWidth = ref(500)
    const rightWidth = ref(320)
    const SPLITTER_MIN_L = 300
    const SPLITTER_MIN_R = 250
    const SETTING_KEY_L = 'captura_detail_left_width'
    const SETTING_KEY_R = 'captura_detail_right_width'

    const detectedInputs = computed(() => {
      const meta = metadata.value.find(m => m.key === 'detected_inputs')
      if (!meta) return null
      try {
        return JSON.parse(meta.value)
      } catch {
        return null
      }
    })

    const filteredMetadata = computed(() => {
      return metadata.value.filter(m => m.key !== 'quick_notes')
    })

    function onImageLoad() {
      if (!imageRef.value || !detectedInputs.value) return
      const { viewportHeight, pageHeight } = detectedInputs.value
      const nh = imageRef.value.naturalHeight
      useDocumentRect.value = nh > viewportHeight * 1.2 && Math.abs(nh - pageHeight) < 50
    }

    function rectStyle(control, index) {
      const detected = detectedInputs.value
      if (!detected) return {}
      const r = useDocumentRect.value ? (control.documentRect || control.rect) : control.rect
      const refW = useDocumentRect.value ? detected.pageWidth : detected.viewportWidth
      const refH = useDocumentRect.value ? detected.pageHeight : detected.viewportHeight
      if (!refW || !refH) return {}
      const style = {
        left: `${(r.x / refW) * 100}%`,
        top: `${(r.y / refH) * 100}%`,
        width: `${(r.width / refW) * 100}%`,
        height: `${(r.height / refH) * 100}%`,
      }
      if (highlightedControlIndex.value === index) {
        style.borderColor = '#FFA726'
        style.backgroundColor = 'rgba(255, 167, 38, 0.25)'
      }
      return style
    }

    function onRectHover(index) {
      if (selectionMode) return
      hoveredControlIndex.value = index
    }

    function onRectLeave() {
      hoveredControlIndex.value = null
    }

    function onRectClick(index) {
      if (selectionMode.value && pendingNoteIndex.value != null) {
        assignControl(pendingNoteIndex.value, index)
      }
    }

    function onNoteHover(ni) {
      highlightedNoteIndex.value = ni
    }

    function onNoteLeave() {
      highlightedNoteIndex.value = null
    }

    function onViewControlClick(ni) {
      const note = notes.value[ni]
      if (!note || note.controlIndex == null) return
      showOverlay.value = true
      highlightedControlIndex.value = note.controlIndex
    }

    function onDropdownHover(e) {
      const li = e.target.closest('[data-ci]')
      highlightedControlIndex.value = li ? parseInt(li.dataset.ci) : null
    }

    function onOpenDropdown(ni) {
      pendingNoteIndex.value = ni
      showOverlay.value = true
    }

    function assignControl(ni, ci) {
      notes.value[ni].controlIndex = ci
      highlightedControlIndex.value = ci
      showOverlay.value = true
      selectionMode.value = false
      pendingNoteIndex.value = null
      saveNotes()
    }

    function badgeLabel(ci) {
      if (!detectedInputs.value || !detectedInputs.value.controls[ci]) return `#${ci}`
      const ctrl = detectedInputs.value.controls[ci]
      return `${ctrl.tag}${ctrl.type ? `[${ctrl.type}]` : ''} — ${ctrl.label || ctrl.name || ctrl.id || `#${ci}`}`
    }

    function formatRect(rect) {
      if (!rect) return ''
      return `${Math.round(rect.x)},${Math.round(rect.y)} ${Math.round(rect.width)}×${Math.round(rect.height)}`
    }

    function formatTime(dateStr) {
      if (!dateStr) return ''
      const d = new Date(dateStr)
      return d.toLocaleTimeString('es-AR', { hour: '2-digit', minute: '2-digit' })
    }

    async function loadMetadata() {
      loadingMetadata.value = true
      try {
        const res = await fetch(`/api/archivos/${props.captura.id}/metadata`, { credentials: 'include' })
        if (res.ok) {
          const data = await res.json()
          metadata.value = data.metadata || []
          initNotes()
        }
      } catch (err) {
        console.error('Error al cargar metadata:', err)
      } finally {
        loadingMetadata.value = false
      }
    }

    function initNotes() {
      const meta = metadata.value.find(m => m.key === 'quick_notes')
      if (meta) {
        try {
          notes.value = JSON.parse(meta.value)
        } catch {
          notes.value = []
        }
      } else {
        notes.value = []
      }
    }

    async function saveNotes() {
      try {
        await fetch(`/api/archivos/${props.captura.id}/metadata`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          credentials: 'include',
          body: JSON.stringify({
            key: 'quick_notes',
            value: JSON.stringify(notes.value),
          }),
        })
      } catch (err) {
        console.error('Error al guardar notas:', err)
      }
    }

    function addNote() {
      const text = noteText.value.trim()
      if (!text) return
      notes.value.push({
        id: generateId(),
        text,
        controlIndex: null,
        createdAt: new Date().toISOString(),
      })
      noteText.value = ''
      saveNotes()
    }

    function deleteNote(ni) {
      if (!confirm('¿Eliminar esta nota?')) return
      notes.value.splice(ni, 1)
      if (pendingNoteIndex.value === ni) {
        selectionMode.value = false
        pendingNoteIndex.value = null
      } else if (pendingNoteIndex.value > ni) {
        pendingNoteIndex.value--
      }
      saveNotes()
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

    // --- Layout persistence ---
    async function loadLayoutPrefs() {
      try {
        const [dL, dR] = await Promise.all([
          settingGet(SETTING_KEY_L),
          settingGet(SETTING_KEY_R),
        ])
        if (dL.value) leftWidth.value = Math.max(SPLITTER_MIN_L, parseInt(dL.value, 10) || SPLITTER_MIN_L)
        if (dR.value) rightWidth.value = Math.max(SPLITTER_MIN_R, parseInt(dR.value, 10) || SPLITTER_MIN_R)
      } catch (err) {
        console.error('Error al cargar preferencias de layout:', err)
      }
    }

    async function saveLayoutPrefs() {
      try {
        await Promise.all([
          settingSet(SETTING_KEY_L, String(leftWidth.value)),
          settingSet(SETTING_KEY_R, String(rightWidth.value)),
        ])
      } catch (err) {
        console.error('Error al guardar preferencias de layout:', err)
      }
    }

    function onSplitterStart(e) {
      const startX = e.clientX
      const startL = leftWidth.value
      const totalW = window.innerWidth

      function onMouseMove(e) {
        const delta = e.clientX - startX
        const newL = Math.max(SPLITTER_MIN_L, Math.min(totalW - SPLITTER_MIN_R, startL + delta))
        leftWidth.value = newL
        rightWidth.value = totalW - newL
      }

      function onMouseUp() {
        document.removeEventListener('mousemove', onMouseMove)
        document.removeEventListener('mouseup', onMouseUp)
        saveLayoutPrefs()
      }

      document.addEventListener('mousemove', onMouseMove)
      document.addEventListener('mouseup', onMouseUp)
    }

    onMounted(async () => {
      await loadLayoutPrefs()
      await loadMetadata()
    })

    return {
      activeTab,
      metadata,
      loadingMetadata,
      showOverlay,
      imageRef,
      hoveredControlIndex,
      highlightedControlIndex,
      selectionMode,
      pendingNoteIndex,
      notes,
      noteText,
      highlightedNoteIndex,
      dropdownRefs,
      leftWidth,
      rightWidth,
      detectedInputs,
      filteredMetadata,
      onImageLoad,
      rectStyle,
      onRectHover,
      onRectLeave,
      onRectClick,
      onNoteHover,
      onNoteLeave,
      onViewControlClick,
      onDropdownHover,
      onOpenDropdown,
      assignControl,
      badgeLabel,
      formatRect,
      formatTime,
      addNote,
      deleteNote,
      eliminarMetadata,
      formatDate,
      onSplitterStart,
    }
  },
}
</script>

<style scoped>
.captura-detail {
  color: #cbd5e1;
  overflow: hidden;
}

/* Left column */
.left-col {
  overflow: hidden;
}
.nav-tabs .nav-link.active {
  color: #75AADB !important;
  border-bottom-color: #75AADB !important;
}
.nav-tabs .nav-link:hover {
  color: #f8f9fa !important;
}

.captura-preview-tab {
  padding: 0 8px;
}

/* Splitter */
.splitter {
  width: 6px;
  cursor: col-resize;
  background: #1e2a4a;
  flex-shrink: 0;
  transition: background 0.15s;
}
.splitter:hover {
  background: #2d3f6a;
}

/* Right column */
.right-col {
  overflow: hidden;
  border-left: 1px solid #374151;
  background: #0f1a30;
}
.right-header {
  border-bottom: 1px solid #374151;
}

.notes-list {
  flex: 1;
}

.note-item {
  background: #1a2744;
  border: 1px solid #374151;
  transition: border-color 0.15s;
}
.note-item:hover {
  border-color: #75AADB;
}

.note-badge {
  display: inline-block;
  background: #0d1b3a;
  color: #75AADB;
  border: 1px solid #2d4a7a;
  border-radius: 4px;
  padding: 1px 6px;
  font-family: monospace;
  transition: background 0.15s, border-color 0.15s;
}
.note-badge:hover,
.note-badge.badge-highlight {
  background: #2d4a7a;
  border-color: #75AADB;
}
.note-badge-general {
  display: inline-block;
  color: #6b7280;
  font-style: italic;
  font-size: 0.65rem;
}
.note-text {
  color: #cbd5e1;
  line-height: 1.4;
  word-break: break-word;
}

.note-input-area {
  border-top: 1px solid #374151;
  background: #0d1117;
}

/* Metadata tab */
.metadata-tab {
  padding: 0 8px;
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

/* Image overlay */
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

.input-rect.rect-selection {
  border-color: #4CAF50 !important;
  background: rgba(76, 175, 80, 0.15) !important;
  animation: pulse-green 1s ease-in-out infinite;
}
.input-rect.rect-selection:hover {
  background: rgba(76, 175, 80, 0.3) !important;
}

@keyframes pulse-green {
  0%, 100% { border-color: #4CAF50; }
  50% { border-color: #81C784; }
}

.selection-badge {
  position: absolute;
  top: -8px;
  left: -8px;
  width: 18px;
  height: 18px;
  border-radius: 50%;
  background: #4CAF50;
  color: #fff;
  font-size: 0.6rem;
  font-weight: 700;
  display: flex;
  align-items: center;
  justify-content: center;
  pointer-events: none;
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

/* Dropdown overrides */
:deep(.dropdown-menu) {
  background: #1a2744;
  border-color: #374151;
}
:deep(.dropdown-item:hover) {
  background: #2d4a7a !important;
  color: #f8f9fa !important;
}
</style>
