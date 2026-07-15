<template>
  <div class="archivos-container d-flex flex-grow-1 overflow-hidden" style="min-height: 0;">
    <div class="archivos-tree-panel flex-shrink-0 overflow-hidden" :style="{ width: effectiveArchivosTreeWidth + 'px' }">
      <FileTreePanel :session-id="activeSessionId" @file-selected="onFileSelected" />
    </div>
    <div class="archivos-splitter" @mousedown.prevent="onArchivosSplitStart"></div>
    <FilePreviewPanel class="flex-grow-1 overflow-hidden" :file-path="selectedFilePath" />
  </div>
</template>

<script>
import { ref, computed, onMounted } from 'vue'
import { storeToRefs } from 'pinia'
import { useChatStore } from '../../../stores/chat.js'
import { useUiStore } from '../../../stores/ui.js'
import { settingSet, settingGet } from '../../../services/settingService.js'
import FileTreePanel from '../../../components/files/FileTreePanel.vue'
import FilePreviewPanel from '../../../components/files/FilePreviewPanel.vue'

export default {
  components: { FileTreePanel, FilePreviewPanel },
  setup() {
    const chat = useChatStore()
    const ui = useUiStore()
    const { activeSessionId } = storeToRefs(chat)
    const { centralPanelCollapsed, sidebarCollapsed } = storeToRefs(ui)

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

    onMounted(() => {
      loadArchivosTreeWidth()
    })

    return {
      activeSessionId,
      selectedFilePath,
      effectiveArchivosTreeWidth,
      onFileSelected,
      onArchivosSplitStart,
    }
  },
}
</script>

<style scoped>
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
</style>
