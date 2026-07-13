<template>
  <div
    class="sidebar-right d-flex flex-column h-100 bg-dark"
    :class="{ collapsed: rightPanelCollapsed }"
    :style="sidebarStyle"
  >
    <div class="tab-bar d-flex align-items-center px-3 pt-0 pb-1 flex-shrink-0">
      <button class="tab-btn" :class="{ active: tab === 'comentarios' }" @click="selectTab('comentarios')">Comentarios</button>
      <button class="tab-btn" :class="{ active: tab === 'archivos' }" @click="selectTab('archivos')">Archivos</button>
      <button class="tab-btn" :class="{ active: tab === 'variables' }" @click="selectTab('variables')">Variables</button>
      <button class="tab-btn" :class="{ active: tab === 'comandos' }" @click="selectTab('comandos')">Comandos</button>
      <button class="tab-btn" :class="{ active: tab === 'capturas' }" @click="selectTab('capturas')">Capturas</button>
      <button class="tab-btn" :class="{ active: tab === 'casos_prueba' }" @click="selectTab('casos_prueba')">Casos de Prueba</button>
      <button v-for="t in moduleTabs" :key="t.id" class="tab-btn" :class="{ active: tab === t.id }" @click="selectTab(t.id)">{{ t.label }}</button>
    </div>

    <SidebarRightComentarios v-if="tab === 'comentarios'" />
    <template v-else-if="tab === 'archivos'">
      <div class="archivos-container d-flex flex-grow-1 overflow-hidden" style="min-height: 0;">
        <div class="archivos-tree-panel flex-shrink-0 overflow-hidden" :style="{ width: effectiveArchivosTreeWidth + 'px' }">
          <FileTreePanel :session-id="activeSessionId" @file-selected="onFileSelected" />
        </div>
        <div class="archivos-splitter" @mousedown.prevent="onArchivosSplitStart"></div>
        <FilePreviewPanel class="flex-grow-1 overflow-hidden" :file-path="selectedFilePath" />
      </div>
    </template>
    <SidebarRightVariables v-else-if="tab === 'variables'" />
    <SidebarRightComandos v-else-if="tab === 'comandos'" />
    <SidebarRightCapturas v-else-if="tab === 'capturas'" />
    <template v-else-if="tab === 'casos_prueba'">
      <div class="casos-prueba-container d-flex flex-grow-1 overflow-hidden" style="min-height: 0;">
        <div class="casos-prueba-list flex-shrink-0 overflow-hidden" :style="{ width: effectiveCasosPruebaListWidth + 'px' }">
          <div class="d-flex align-items-center justify-content-center h-100 text-secondary small px-3 text-center">
            <span>En construcción</span>
          </div>
        </div>
        <div class="casos-prueba-splitter" @mousedown.prevent="onCasosPruebaSplitStart"></div>
        <div class="casos-prueba-middle flex-shrink-0 overflow-hidden" :style="{ width: effectiveCasosPruebaMiddleWidth + 'px' }">
          <div class="d-flex align-items-center justify-content-center h-100 text-secondary small px-3 text-center">
            <span>En construcción</span>
          </div>
        </div>
        <div class="casos-prueba-splitter-middle" @mousedown.prevent="onCasosPruebaMiddleSplitStart"></div>
        <div class="casos-prueba-detail flex-grow-1 d-flex align-items-center justify-content-center text-secondary small px-3 text-center">
          <span>En construcción</span>
        </div>
      </div>
    </template>
    <template v-for="t in moduleTabs" :key="t.id">
      <component :is="t.component" v-if="tab === t.id" />
    </template>
    <div class="sidebar-right-resize-handle" @mousedown.prevent="onResizeStart">
      <div class="sidebar-right-resize-handle-bar"></div>
    </div>
  </div>
</template>

<script>
import { watch, ref, computed, onMounted } from 'vue'
import { storeToRefs } from 'pinia'
import { useUiStore } from '../../stores/ui.js'
import { useChatStore } from '../../stores/chat.js'
import { useDocumentacionNotasStore } from '../../stores/documentacionNotas.js'
import { useModuleRegistry } from '../../composables/useModuleRegistry.js'
import { settingSet, settingGet } from '../../services/settingService.js'
import FileTreePanel from '../files/FileTreePanel.vue'
import FilePreviewPanel from '../files/FilePreviewPanel.vue'
import SidebarRightComentarios from './SidebarRightComentarios.vue'
import SidebarRightVariables from './SidebarRightVariables.vue'
import SidebarRightComandos from './SidebarRightComandos.vue'
import SidebarRightCapturas from './SidebarRightCapturas.vue'
export default {
  components: { FileTreePanel, FilePreviewPanel, SidebarRightComentarios, SidebarRightVariables, SidebarRightComandos, SidebarRightCapturas },
  setup() {
    const ui = useUiStore()
    const chat = useChatStore()
    const docNotasStore = useDocumentacionNotasStore()
    const { rightPanelCollapsed, rightPanelWidth, centralPanelCollapsed, sidebarWidthPct, sidebarCollapsed, sidebarRightTab } = storeToRefs(ui)
    const { activeSessionId, sessions } = storeToRefs(chat)
    const { sidebarRightTabs } = useModuleRegistry()
    const moduleTabs = computed(() => {
      if (!sidebarRightTabs) return []
      return [...sidebarRightTabs].sort((a, b) => (a.priority || 50) - (b.priority || 50))
    })
    const tab = ref('comentarios')
    const stopTabSync = watch(sidebarRightTab, (v) => { tab.value = v; stopTabSync() })

    const activeSession = computed(() => {
      return sessions.value.find(s => s.id === activeSessionId.value) || null
    })

    const proyectoId = computed(() => activeSession.value?.proyecto_id || null)

    const sidebarStyle = computed(() => {
      if (rightPanelCollapsed.value) return {}
      if (centralPanelCollapsed.value) {
        if (sidebarCollapsed.value) {
          return { flex: '1 1 100%', minWidth: '5vw' }
        }
        const rightPct = 100 - sidebarWidthPct.value
        return { flex: `0 0 ${rightPct}%`, minWidth: '5vw' }
      }
      return { width: rightPanelWidth.value + 'px', minWidth: rightPanelWidth.value + 'px' }
    })

    const isFullWidth = computed(() => centralPanelCollapsed.value && sidebarCollapsed.value)

    const selectedFilePath = ref(null)
    const archivosTreeWidth = ref(140)
    const archivosTreeWidthFull = ref(260)
    const ARCHIVOS_TREE_WIDTH_KEY = 'archivos_tree_width'
    const ARCHIVOS_TREE_WIDTH_FULL_KEY = 'archivos_tree_width_full'
    const ARCHIVOS_TREE_MIN = 80

    const effectiveArchivosTreeWidth = computed(() => isFullWidth.value ? archivosTreeWidthFull.value : archivosTreeWidth.value)

    async function loadArchivosTreeWidth() {
      try {
        const [normal, full] = await Promise.all([
          settingGet(ARCHIVOS_TREE_WIDTH_KEY),
          settingGet(ARCHIVOS_TREE_WIDTH_FULL_KEY),
        ])
        if (normal.value) {
          archivosTreeWidth.value = Math.max(ARCHIVOS_TREE_MIN, parseInt(normal.value, 10) || 140)
        }
        if (full.value) {
          archivosTreeWidthFull.value = Math.max(ARCHIVOS_TREE_MIN, parseInt(full.value, 10) || 260)
        }
      } catch (err) {
        console.error('Error al cargar ancho del árbol de archivos:', err)
      }
    }

    async function saveArchivosTreeWidth() {
      try {
        await Promise.all([
          settingSet(ARCHIVOS_TREE_WIDTH_KEY, String(archivosTreeWidth.value)),
          settingSet(ARCHIVOS_TREE_WIDTH_FULL_KEY, String(archivosTreeWidthFull.value)),
        ])
      } catch (err) {
        console.error('Error al guardar ancho del árbol de archivos:', err)
      }
    }

    const casosPruebaListWidth = ref(180)
    const casosPruebaListWidthFull = ref(300)
    const CASOS_PRUEBA_LIST_WIDTH_KEY = 'casos_prueba_list_width'
    const CASOS_PRUEBA_LIST_WIDTH_FULL_KEY = 'casos_prueba_list_width_full'
    const CASOS_PRUEBA_LIST_MIN = 80

    const effectiveCasosPruebaListWidth = computed(() => isFullWidth.value ? casosPruebaListWidthFull.value : casosPruebaListWidth.value)

    async function loadCasosPruebaListWidth() {
      try {
        const [normal, full] = await Promise.all([
          settingGet(CASOS_PRUEBA_LIST_WIDTH_KEY),
          settingGet(CASOS_PRUEBA_LIST_WIDTH_FULL_KEY),
        ])
        if (normal.value) {
          casosPruebaListWidth.value = Math.max(CASOS_PRUEBA_LIST_MIN, parseInt(normal.value, 10) || 180)
        }
        if (full.value) {
          casosPruebaListWidthFull.value = Math.max(CASOS_PRUEBA_LIST_MIN, parseInt(full.value, 10) || 300)
        }
      } catch (err) {
        console.error('Error al cargar ancho de lista de casos de prueba:', err)
      }
    }

    async function saveCasosPruebaListWidth() {
      try {
        await Promise.all([
          settingSet(CASOS_PRUEBA_LIST_WIDTH_KEY, String(casosPruebaListWidth.value)),
          settingSet(CASOS_PRUEBA_LIST_WIDTH_FULL_KEY, String(casosPruebaListWidthFull.value)),
        ])
      } catch (err) {
        console.error('Error al guardar ancho de lista de casos de prueba:', err)
      }
    }

    const casosPruebaMiddleWidth = ref(180)
    const casosPruebaMiddleWidthFull = ref(300)
    const CASOS_PRUEBA_MIDDLE_WIDTH_KEY = 'casos_prueba_middle_width'
    const CASOS_PRUEBA_MIDDLE_WIDTH_FULL_KEY = 'casos_prueba_middle_width_full'
    const CASOS_PRUEBA_MIDDLE_MIN = 80

    const effectiveCasosPruebaMiddleWidth = computed(() => isFullWidth.value ? casosPruebaMiddleWidthFull.value : casosPruebaMiddleWidth.value)

    async function loadCasosPruebaMiddleWidth() {
      try {
        const [normal, full] = await Promise.all([
          settingGet(CASOS_PRUEBA_MIDDLE_WIDTH_KEY),
          settingGet(CASOS_PRUEBA_MIDDLE_WIDTH_FULL_KEY),
        ])
        if (normal.value) {
          casosPruebaMiddleWidth.value = Math.max(CASOS_PRUEBA_MIDDLE_MIN, parseInt(normal.value, 10) || 180)
        }
        if (full.value) {
          casosPruebaMiddleWidthFull.value = Math.max(CASOS_PRUEBA_MIDDLE_MIN, parseInt(full.value, 10) || 300)
        }
      } catch (err) {
        console.error('Error al cargar ancho de columna media de casos de prueba:', err)
      }
    }

    async function saveCasosPruebaMiddleWidth() {
      try {
        await Promise.all([
          settingSet(CASOS_PRUEBA_MIDDLE_WIDTH_KEY, String(casosPruebaMiddleWidth.value)),
          settingSet(CASOS_PRUEBA_MIDDLE_WIDTH_FULL_KEY, String(casosPruebaMiddleWidthFull.value)),
        ])
      } catch (err) {
        console.error('Error al guardar ancho de columna media de casos de prueba:', err)
      }
    }

    function onCasosPruebaSplitStart(e) {
      const startX = e.clientX
      const startWidth = casosPruebaListWidth.value
      const startWidthFull = casosPruebaListWidthFull.value
      const container = e.target.closest('.casos-prueba-container')

      function onMouseMove(e) {
        const delta = e.clientX - startX
        const containerWidth = container ? container.getBoundingClientRect().width : 400
        const minWidth = 80
        const maxWidth = containerWidth - 80
        if (isFullWidth.value) {
          casosPruebaListWidthFull.value = Math.max(minWidth, Math.min(maxWidth, startWidthFull + delta))
        } else {
          casosPruebaListWidth.value = Math.max(minWidth, Math.min(maxWidth, startWidth + delta))
        }
      }

      function onMouseUp() {
        document.removeEventListener('mousemove', onMouseMove)
        document.removeEventListener('mouseup', onMouseUp)
        document.body.style.cursor = ''
        document.body.style.userSelect = ''
        saveCasosPruebaListWidth()
      }

      document.addEventListener('mousemove', onMouseMove)
      document.addEventListener('mouseup', onMouseUp)
      document.body.style.cursor = 'col-resize'
      document.body.style.userSelect = 'none'
    }

    function onCasosPruebaMiddleSplitStart(e) {
      const startX = e.clientX
      const startWidth = casosPruebaMiddleWidth.value
      const startWidthFull = casosPruebaMiddleWidthFull.value
      const container = e.target.closest('.casos-prueba-container')

      function onMouseMove(e) {
        const delta = e.clientX - startX
        const containerWidth = container ? container.getBoundingClientRect().width : 400
        const minWidth = 80
        const maxWidth = containerWidth - 80
        if (isFullWidth.value) {
          casosPruebaMiddleWidthFull.value = Math.max(minWidth, Math.min(maxWidth, startWidthFull + delta))
        } else {
          casosPruebaMiddleWidth.value = Math.max(minWidth, Math.min(maxWidth, startWidth + delta))
        }
      }

      function onMouseUp() {
        document.removeEventListener('mousemove', onMouseMove)
        document.removeEventListener('mouseup', onMouseUp)
        document.body.style.cursor = ''
        document.body.style.userSelect = ''
        saveCasosPruebaMiddleWidth()
      }

      document.addEventListener('mousemove', onMouseMove)
      document.addEventListener('mouseup', onMouseUp)
      document.body.style.cursor = 'col-resize'
      document.body.style.userSelect = 'none'
    }

    function onFileSelected({ path, name }) {
      selectedFilePath.value = path
    }

    function onArchivosSplitStart(e) {
      const startX = e.clientX
      const startWidth = archivosTreeWidth.value
      const startWidthFull = archivosTreeWidthFull.value
      const container = e.target.closest('.archivos-container')

      function onMouseMove(e) {
        const delta = e.clientX - startX
        const containerWidth = container ? container.getBoundingClientRect().width : 400
        const minWidth = 80
        const maxWidth = containerWidth - 80
        if (isFullWidth.value) {
          archivosTreeWidthFull.value = Math.max(minWidth, Math.min(maxWidth, startWidthFull + delta))
        } else {
          archivosTreeWidth.value = Math.max(minWidth, Math.min(maxWidth, startWidth + delta))
        }
      }

      function onMouseUp() {
        document.removeEventListener('mousemove', onMouseMove)
        document.removeEventListener('mouseup', onMouseUp)
        document.body.style.cursor = ''
        document.body.style.userSelect = ''
        saveArchivosTreeWidth()
      }

      document.addEventListener('mousemove', onMouseMove)
      document.addEventListener('mouseup', onMouseUp)
      document.body.style.cursor = 'col-resize'
      document.body.style.userSelect = 'none'
    }

    function selectTab(val) {
      tab.value = val
      sidebarRightTab.value = val
      ui.saveLayoutPrefs()
    }

    function onResizeStart(e) {
      const resizeHandle = e.currentTarget

      function onMouseMove(e) {
        if (ui.centralPanelCollapsed) {
          const container = resizeHandle.closest('.sidebar-right')?.parentElement
          const containerWidth = container ? container.getBoundingClientRect().width : window.innerWidth
          const rightPct = ((containerWidth - e.clientX) / containerWidth) * 100
          ui.setSidebarWidthPct(100 - Math.max(5, Math.min(95, rightPct)))
        } else {
          const leftWidth = ui.sidebarCollapsed ? 0 : ui.sidebarWidth
          const maxAllowed = Math.max(window.innerWidth * 0.05, window.innerWidth - leftWidth - window.innerWidth * 0.05)
          rightPanelWidth.value = Math.max(window.innerWidth * 0.05, Math.min(maxAllowed, window.innerWidth - e.clientX))
        }
      }

      function onMouseUp() {
        document.removeEventListener('mousemove', onMouseMove)
        document.removeEventListener('mouseup', onMouseUp)
        document.body.style.cursor = ''
        document.body.style.userSelect = ''
        ui.saveLayoutPrefs()
      }

      document.addEventListener('mousemove', onMouseMove)
      document.addEventListener('mouseup', onMouseUp)
      document.body.style.cursor = 'col-resize'
      document.body.style.userSelect = 'none'
    }

    watch(proyectoId, (newId) => {
      if (!newId) {
        docNotasStore.clearNotas()
        return
      }
      docNotasStore.loadNotas(newId)
    })

    onMounted(() => {
      loadArchivosTreeWidth()
      loadCasosPruebaListWidth()
      loadCasosPruebaMiddleWidth()
    })

    return {
      rightPanelCollapsed,
      rightPanelWidth,
      sidebarStyle,
      tab,
      selectTab,
      activeSessionId,
      moduleTabs,
      onResizeStart,
      selectedFilePath,
      effectiveArchivosTreeWidth,
      onFileSelected,
      onArchivosSplitStart,
      effectiveCasosPruebaListWidth,
      onCasosPruebaSplitStart,
      effectiveCasosPruebaMiddleWidth,
      onCasosPruebaMiddleSplitStart,
    }
  },
}
</script>

<style scoped>
.tab-bar {
  border-bottom: 1px solid #374151;
  overflow: hidden;
  white-space: nowrap;
}
.tab-btn {
  background: none;
  border: none;
  color: #6b7280;
  font-size: 0.75rem;
  padding: 4px 10px;
  cursor: pointer;
  border-bottom: 2px solid transparent;
  margin-bottom: -1px;
  transition: color 0.15s, border-color 0.15s;
}
.tab-btn:hover {
  color: #cbd5e1;
}
.tab-btn.active {
  color: #75AADB;
  border-bottom-color: #75AADB;
}
.sidebar-right {
  position: relative;
  padding: 8px;
  border-left: 1px solid #374151;
  background: #1a1a2e;
}
.sidebar-right.collapsed {
  width: 0 !important;
  min-width: 0 !important;
  padding: 0;
  border: none;
  overflow: hidden;
}
.sidebar-right-resize-handle {
  position: absolute;
  top: 0;
  left: -6px;
  width: 12px;
  height: 100%;
  cursor: col-resize;
  z-index: 10;
  display: flex;
  align-items: center;
  justify-content: center;
}
.sidebar-right-resize-handle:hover {
  background: rgba(117, 170, 219, 0.08);
}
.sidebar-right-resize-handle-bar {
  width: 3px;
  height: 36px;
  background: #374151;
  border-radius: 2px;
  pointer-events: none;
  transition: background 0.15s;
}
.sidebar-right-resize-handle:hover .sidebar-right-resize-handle-bar {
  background: #75AADB;
}
.archivos-container {
  min-height: 0;
}
.archivos-tree-panel {
  min-width: 80px;
}
.archivos-splitter {
  width: 6px;
  cursor: col-resize;
  flex-shrink: 0;
  background: transparent;
  transition: background 0.15s;
  position: relative;
  z-index: 5;
}
.archivos-splitter:hover {
  background: rgba(117, 170, 219, 0.12);
}
.casos-prueba-container {
  background: #16213e;
}
.casos-prueba-list {
  background: #16213e;
}
.casos-prueba-splitter {
  width: 6px;
  cursor: col-resize;
  flex-shrink: 0;
  background: transparent;
  transition: background 0.15s;
  position: relative;
  z-index: 5;
}
.casos-prueba-splitter:hover {
  background: rgba(117, 170, 219, 0.12);
}
.casos-prueba-middle {
  background: #16213e;
}
.casos-prueba-splitter-middle {
  width: 6px;
  cursor: col-resize;
  flex-shrink: 0;
  background: transparent;
  transition: background 0.15s;
  position: relative;
  z-index: 5;
}
.casos-prueba-splitter-middle:hover {
  background: rgba(117, 170, 219, 0.12);
}
.casos-prueba-detail {
  background: #0f172a;
}
</style>
