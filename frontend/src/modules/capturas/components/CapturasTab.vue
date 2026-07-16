<template>
  <div v-if="!activeSession" class="d-flex flex-column align-items-center justify-content-center flex-grow-1 text-secondary small px-3 text-center">
    <span>Seleccione una sesión de chat</span>
  </div>
  <div v-else-if="!proyectoId" class="d-flex flex-column align-items-center justify-content-center flex-grow-1 text-secondary small px-3 text-center">
    <span>Sin proyecto asignado a esta sesión</span>
  </div>
  <div v-else class="d-flex flex-column flex-grow-1 overflow-hidden" style="min-height: 0;">
    <div class="capturas-filter d-flex align-items-center px-2 py-1 flex-shrink-0 gap-2" style="border-bottom: 1px solid #374151;">
      <label class="d-flex align-items-center gap-2 small" style="cursor: pointer; font-size: 0.7rem; color: #cbd5e1;">
        <input type="checkbox" v-model="filtrarPorSesion" class="form-check-input m-0" style="cursor: pointer; width: 14px; height: 14px;" />
        Solo sesión actual
      </label>
      <button class="btn btn-sm btn-outline-argentina ms-auto py-0 px-2" style="font-size: 0.65rem;" @click="tomarCaptura" :disabled="!activeSession || !proyectoId">📷 Capturar</button>
    </div>
    <div v-if="loadingCapturas" class="d-flex flex-column align-items-center justify-content-center flex-grow-1 text-secondary small">
      <span>Cargando capturas…</span>
    </div>
    <div v-else class="capturas-container d-flex flex-grow-1 overflow-hidden" style="min-height: 0;">
      <div class="capturas-list flex-shrink-0 overflow-y-auto" :style="{ width: effectiveCapturasListWidth + 'px' }">
        <div v-if="capturas.length === 0" class="d-flex align-items-center justify-content-center text-secondary small px-3 py-4 text-center">
          <span>Sin capturas de pantalla</span>
        </div>
        <div v-for="c in capturas" :key="c.id" class="captura-item d-flex align-items-start px-2 py-2 mb-1 rounded position-relative"
          :class="{ selected: capturaSeleccionada?.id === c.id }" @click="seleccionarCaptura(c)" role="button">
          <div class="captura-thumb me-2 flex-shrink-0">
            <img :src="`/api/archivos/${c.id}/download`" class="rounded" style="width: 40px; height: 30px; object-fit: cover;" @error="$event.target.style.display='none'" />
          </div>
          <div class="captura-info min-width-0 flex-grow-1">
            <div class="captura-nombre text-truncate small">{{ c.nombre_original }}</div>
            <div class="captura-fecha text-muted" style="font-size: 0.6rem;">{{ formatDate(c.created_at) }}</div>
          </div>
          <div class="captura-actions d-flex flex-column gap-1 ms-1 flex-shrink-0">
            <button class="captura-detail-btn" title="Ver detalles" @click.stop="verDetallesCaptura(c)">🔍</button>
            <a :href="`/api/archivos/${c.id}/download`" download :title="`Descargar ${c.nombre_original}`" class="captura-download-btn" @click.stop>⬇</a>
            <button class="captura-delete-btn" title="Eliminar captura" @click.stop="eliminarCaptura(c)">✕</button>
          </div>
        </div>
      </div>
      <div class="capturas-splitter" @mousedown.prevent="onCapturasSplitStart"></div>
      <div v-if="capturaSeleccionada" class="captura-preview flex-grow-1 d-flex flex-column align-items-center justify-content-start overflow-auto p-2">
        <img :src="`/api/archivos/${capturaSeleccionada.id}/download`" class="img-fluid rounded" style="max-width: 100%;" />
        <div class="captura-preview-info text-center mt-2 small">
          <div class="text-light">{{ capturaSeleccionada.nombre_original }}</div>
          <div class="text-muted">{{ (capturaSeleccionada.tamano / 1024).toFixed(1) }} KB — {{ formatDate(capturaSeleccionada.created_at) }}</div>
        </div>
        <div class="captura-toolbar mt-2 pt-2 border-top border-secondary w-100 d-flex align-items-center justify-content-center gap-1 small text-muted">
          <button class="toolbar-btn disabled" title="Recortar" disabled>✂</button>
          <button class="toolbar-btn disabled" title="Rotar" disabled>🔄</button>
          <button class="toolbar-btn disabled" title="Anotar" disabled>✏</button>
          <button class="toolbar-btn disabled" title="Escalar" disabled>🔲</button>
          <span class="mx-1 text-secondary" style="font-size: 0.6rem; opacity: 0.4;">|</span>
          <span style="font-size: 0.6rem; opacity: 0.6;">🔧 En construcción</span>
        </div>
      </div>
      <div v-else class="captura-preview flex-grow-1 d-flex align-items-center justify-content-center text-secondary small px-3 text-center">
        <span>Seleccione una captura para previsualizar</span>
      </div>
    </div>
  </div>
</template>

<script>
import { watch, ref, computed, onMounted } from 'vue'
import { storeToRefs } from 'pinia'
import { useChatStore } from '../../../stores/chat.js'
import { useUiStore } from '../../../stores/ui.js'
import { useModalStore } from '../../../stores/modal.js'
import { useCommandRegistry } from '../../../composables/useCommandRegistry.js'
import { settingSet, settingGet } from '../../../services/settingService.js'
import CapturaDetailModal from '../../../components/modals/CapturaDetailModal.vue'

export default {
  setup() {
    const ui = useUiStore()
    const chat = useChatStore()
    const modal = useModalStore()
    const { find } = useCommandRegistry()
    const { activeSessionId, sessions } = storeToRefs(chat)
    const { centralPanelCollapsed, sidebarCollapsed } = storeToRefs(ui)

    const isFullWidth = computed(() => centralPanelCollapsed.value && sidebarCollapsed.value)

    const activeSession = computed(() => {
      return sessions.value.find(s => Number(s.id) === Number(activeSessionId.value)) || null
    })

    const proyectoId = computed(() => activeSession.value?.proyecto_id || null)

    const capturas = ref([])
    const loadingCapturas = ref(false)
    const capturaSeleccionada = ref(null)
    const filtrarPorSesion = ref(true)

    const capturasListWidth = ref(160)
    const capturasListWidthFull = ref(280)
    const CAPTURAS_LIST_WIDTH_KEY = 'capturas_list_width'
    const CAPTURAS_LIST_WIDTH_FULL_KEY = 'capturas_list_width_full'
    const CAPTURAS_LIST_MIN = 80

    const effectiveCapturasListWidth = computed(() => isFullWidth.value ? capturasListWidthFull.value : capturasListWidth.value)

    async function loadCapturasListWidth() {
      try {
        const [normal, full] = await Promise.all([
          settingGet(CAPTURAS_LIST_WIDTH_KEY),
          settingGet(CAPTURAS_LIST_WIDTH_FULL_KEY),
        ])
        if (normal.value) {
          capturasListWidth.value = Math.max(CAPTURAS_LIST_MIN, parseInt(normal.value, 10) || 160)
        }
        if (full.value) {
          capturasListWidthFull.value = Math.max(CAPTURAS_LIST_MIN, parseInt(full.value, 10) || 280)
        }
      } catch (err) {
        console.error('Error al cargar ancho de lista de capturas:', err)
      }
    }

    async function saveCapturasListWidth() {
      try {
        await Promise.all([
          settingSet(CAPTURAS_LIST_WIDTH_KEY, String(capturasListWidth.value)),
          settingSet(CAPTURAS_LIST_WIDTH_FULL_KEY, String(capturasListWidthFull.value)),
        ])
      } catch (err) {
        console.error('Error al guardar ancho de lista de capturas:', err)
      }
    }

    function formatDate(dateStr) {
      if (!dateStr) return ''
      const d = new Date(dateStr)
      return d.toLocaleDateString('es-AR', { day: '2-digit', month: '2-digit', year: '2-digit', hour: '2-digit', minute: '2-digit' })
    }

    async function loadCapturas(proyectoId) {
      if (!proyectoId) return
      loadingCapturas.value = true
      try {
        let url = `/api/archivos?proyecto_id=${encodeURIComponent(proyectoId)}&tipo=image/png`
        if (filtrarPorSesion.value && activeSessionId.value) {
          url += `&chat_session_id=${activeSessionId.value}`
        }
        const res = await fetch(url, { credentials: 'include' })
        if (res.ok) {
          const data = await res.json()
          capturas.value = data.archivos || []
        } else {
          capturas.value = []
        }
      } catch (err) {
        console.error('Error al cargar capturas:', err)
        capturas.value = []
      } finally {
        loadingCapturas.value = false
      }
    }

    function seleccionarCaptura(c) {
      capturaSeleccionada.value = c
    }

    function verDetallesCaptura(c) {
      modal.open(CapturaDetailModal, { captura: c }, { title: c.nombre_original, wide: true })
    }

    async function eliminarCaptura(c) {
      if (!confirm(`¿Eliminar la captura "${c.nombre_original}"?`)) return
      try {
        const res = await fetch(`/api/archivos/${c.id}`, {
          method: 'DELETE',
          credentials: 'include',
        })
        if (!res.ok) {
          const err = await res.json()
          throw new Error(err.error || 'Error al eliminar')
        }
        capturas.value = capturas.value.filter(a => a.id !== c.id)
        if (capturaSeleccionada.value?.id === c.id) {
          capturaSeleccionada.value = null
        }
      } catch (err) {
        console.error('Error al eliminar captura:', err)
      }
    }

    async function tomarCaptura() {
      const sid = activeSessionId.value
      if (!sid) return

      const cmd = find('/navegador_capturar_pantalla')
      if (!cmd) {
        console.error('Comando /navegador_capturar_pantalla no encontrado')
        return
      }

      await chat.runCommand('/navegador_capturar_pantalla', async (loadingIdx, sessionId) => {
        return cmd.execute([], { chatStore: chat, sessionId })
      })

      if (proyectoId.value) {
        await loadCapturas(proyectoId.value)
      }
    }

    function onCapturasSplitStart(e) {
      const startX = e.clientX
      const startWidth = capturasListWidth.value
      const startWidthFull = capturasListWidthFull.value
      const container = e.target.closest('.capturas-container')

      function onMouseMove(e) {
        const delta = e.clientX - startX
        const containerWidth = container ? container.getBoundingClientRect().width : 400
        const minWidth = 80
        const maxWidth = containerWidth - 80
        if (isFullWidth.value) {
          capturasListWidthFull.value = Math.max(minWidth, Math.min(maxWidth, startWidthFull + delta))
        } else {
          capturasListWidth.value = Math.max(minWidth, Math.min(maxWidth, startWidth + delta))
        }
      }

      function onMouseUp() {
        document.removeEventListener('mousemove', onMouseMove)
        document.removeEventListener('mouseup', onMouseUp)
        document.body.style.cursor = ''
        document.body.style.userSelect = ''
        saveCapturasListWidth()
      }

      document.addEventListener('mousemove', onMouseMove)
      document.addEventListener('mouseup', onMouseUp)
      document.body.style.cursor = 'col-resize'
      document.body.style.userSelect = 'none'
    }

    watch(proyectoId, (newId) => {
      if (!newId) {
        capturas.value = []
        capturaSeleccionada.value = null
        return
      }
      loadCapturas(newId)
    }, { immediate: true })

    watch(filtrarPorSesion, () => {
      if (proyectoId.value) {
        loadCapturas(proyectoId.value)
      }
    })

    watch(activeSessionId, () => {
      if (proyectoId.value && filtrarPorSesion.value) {
        loadCapturas(proyectoId.value)
      }
    })

    onMounted(() => {
      loadCapturasListWidth()
    })

    return {
      activeSession,
      proyectoId,
      capturas,
      loadingCapturas,
      capturaSeleccionada,
      effectiveCapturasListWidth,
      filtrarPorSesion,
      seleccionarCaptura,
      verDetallesCaptura,
      eliminarCaptura,
      onCapturasSplitStart,
      tomarCaptura,
      formatDate,
    }
  },
}
</script>

<style scoped>
.capturas-container {
  background: #16213e;
}
.capturas-list {
  background: #16213e;
}
.captura-item {
  background: #1a2744;
  border: 1px solid #374151;
  cursor: pointer;
}
.captura-item:hover {
  background: #1e3050;
}
.captura-item.selected {
  background: #1e3050;
  border-color: #75AADB;
}
.captura-item:hover .captura-actions {
  display: flex;
}
.captura-actions {
  display: none;
}
.captura-detail-btn, .captura-download-btn, .captura-delete-btn {
  background: none;
  border: none;
  font-size: 0.65rem;
  cursor: pointer;
  padding: 1px 4px;
  border-radius: 3px;
  line-height: 1.2;
  text-decoration: none;
  color: #6b7280;
  transition: color 0.15s, background 0.15s;
}
.captura-detail-btn:hover {
  color: #f8f9fa;
  background: rgba(255, 255, 255, 0.1);
}
.captura-download-btn:hover {
  color: #75AADB;
  background: rgba(117, 170, 219, 0.12);
}
.captura-delete-btn:hover {
  color: #ef4444;
  background: rgba(239, 68, 68, 0.12);
}
.captura-nombre {
  color: #cbd5e1;
  font-size: 0.7rem;
  line-height: 1.2;
}
.captura-fecha {
  font-size: 0.6rem;
}
.captura-preview {
  background: #0f172a;
}
.captura-preview-info {
  font-size: 0.7rem;
}
.captura-toolbar {
  background: #1a2744;
  border-radius: 4px;
  padding: 4px 8px;
}
.toolbar-btn {
  background: none;
  border: 1px solid transparent;
  color: #6b7280;
  font-size: 0.8rem;
  cursor: pointer;
  padding: 2px 6px;
  border-radius: 3px;
  line-height: 1.2;
  transition: color 0.15s, background 0.15s, border-color 0.15s;
}
.toolbar-btn:hover:not(.disabled) {
  color: #cbd5e1;
  background: rgba(255, 255, 255, 0.05);
  border-color: #374151;
}
.toolbar-btn.disabled {
  opacity: 0.4;
  cursor: not-allowed;
}
.capturas-splitter {
  width: 6px;
  cursor: col-resize;
  flex-shrink: 0;
  background: transparent;
  transition: background 0.15s;
  position: relative;
  z-index: 5;
}
.capturas-splitter:hover {
  background: rgba(117, 170, 219, 0.12);
}
</style>
