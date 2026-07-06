<template>
  <div class="file-tree-panel d-flex flex-column h-100">
    <div v-if="!sessionId" class="text-muted p-2 small text-center" style="margin-top: 1rem;">
      Sin sesión de chat
    </div>
    <div v-else-if="loading" class="text-muted p-2 small text-center" style="margin-top: 1rem;">
      Cargando árbol de archivos...
    </div>
    <div v-else-if="error" class="p-2 small text-center" style="margin-top: 1rem;">
      <span class="text-danger">{{ error }}</span>
      <button class="btn btn-sm btn-outline-secondary ms-2 mt-1" @click="reloadTree">Reintentar</button>
    </div>
    <div v-else class="d-flex flex-column h-100">
      <div class="tree-header small text-muted px-2 py-1 flex-shrink-0 text-truncate" :title="tree.path">
        {{ tree.name }}
      </div>
      <div class="tree-scroll overflow-y-auto flex-grow-1" style="min-height: 0;">
        <div
          v-for="item in flatTree"
          :key="item.node.path"
           class="tree-node d-flex align-items-center py-0"
          :class="{
            'tree-directory': item.node.type === 'directory',
            'tree-selected': item.node.type === 'file' && selectedFile === item.node.path,
          }"
          :style="{ paddingLeft: (item.depth * 20) + 'px' }"
          :title="item.node.path"
          @click="item.node.type === 'directory' ? handleToggleDirectory(item.node.path) : handleFileClick(item.node.path, item.node.name)"
          @contextmenu.prevent="onContextMenu($event, item)"
        >
          <span v-if="item.node.type === 'directory'" class="tree-toggle flex-shrink-0">
            {{ handleIsExpanded(item.node.path) ? '▾' : '▸' }}
          </span>
          <span v-else class="tree-toggle-placeholder flex-shrink-0"></span>
          <span class="tree-icon flex-shrink-0">{{ getFileIcon(item.node) }}</span>
          <span class="tree-name text-truncate small">{{ item.node.name }}</span>
        </div>
      </div>
    </div>

    <div v-if="ctxMenu.show" class="context-menu-backdrop" @click="closeCtxMenu" @contextmenu.prevent="closeCtxMenu"></div>
    <div v-if="ctxMenu.show" class="context-menu" :style="{ left: ctxMenu.x + 'px', top: ctxMenu.y + 'px' }" @click.stop>
      <div class="context-menu-item" @click="copyRelativePath">📋 Copiar ruta relativa</div>
      <div class="context-menu-item" @click="copyFullPath">📋 Copiar ruta completa</div>
      <div class="context-menu-divider"></div>
      <div class="context-menu-item text-danger" @click="confirmDeleteFile">🗑️ Eliminar</div>
    </div>
  </div>
</template>

<script>
import { computed, ref, watch, onBeforeUnmount } from 'vue'
import { useModalStore } from '../../stores/modal.js'
import { useFileTreeStore } from '../../stores/fileTree.js'
import FileEditorModal from './FileEditorModal.vue'
import CsvViewerModal from './CsvViewerModal.vue'
import AlertModal from '../modals/AlertModal.vue'

const FILE_ICONS = {
  js: '\u{1F4D1}',
  vue: '\u{1F4D1}',
  json: '\u{1F4CB}',
  md: '\u{1F4DD}',
  css: '\u{1F3A8}',
  scss: '\u{1F3A8}',
  html: '\u{1F310}',
  svg: '\u{1F5BC}',
  png: '\u{1F5BC}',
  jpg: '\u{1F5BC}',
  jpeg: '\u{1F5BC}',
  gif: '\u{1F5BC}',
  ico: '\u{1F5BC}',
  yml: '\u{2699}',
  yaml: '\u{2699}',
  cfg: '\u{2699}',
  conf: '\u{2699}',
  env: '\u{1F511}',
  gitignore: '\u{1F510}',
  lock: '\u{1F512}',
  sql: '\u{1F4BE}',
  xml: '\u{1F4C4}',
  csv: '\u{1F4CA}',
  txt: '\u{1F4C4}',
  log: '\u{1F4C4}',
}

export default {
  props: {
    sessionId: { type: Number, default: null },
  },
  emits: ['file-selected'],
  setup(props, { emit }) {
    const modal = useModalStore()
    const fileTreeStore = useFileTreeStore()

    const selectedFile = ref(null)
    const ctxMenu = ref({ show: false, x: 0, y: 0, path: '', fullPath: '', type: '' })
    let clickTimer = null

    const tree = computed(() => props.sessionId ? fileTreeStore.getTree(props.sessionId) : null)
    const loading = computed(() => props.sessionId ? fileTreeStore.getLoading(props.sessionId) : false)
    const error = computed(() => props.sessionId ? fileTreeStore.getError(props.sessionId) : null)
    const flatTree = computed(() => props.sessionId ? fileTreeStore.getFlatTree(props.sessionId) : [])

    function handleSelectFile(path, name) {
      selectedFile.value = path
      emit('file-selected', { path, name })
    }

    function handleFileClick(path, name) {
      if (clickTimer) {
        clearTimeout(clickTimer)
        clickTimer = null
        openFile(path)
        return
      }
      clickTimer = setTimeout(() => {
        clickTimer = null
        handleSelectFile(path, name)
      }, 250)
    }

    function openFile(path) {
      const name = path.split('/').pop() || path
      selectedFile.value = path
      if (name.toLowerCase().endsWith('.csv')) {
        modal.open(CsvViewerModal, { filePath: path }, { title: `CSV: ${name}`, wide: true })
      } else {
        modal.open(FileEditorModal, { filePath: path, sessionId: props.sessionId }, { title: `Editar: ${name}`, wide: true })
      }
    }

    function getFileIcon(node) {
      if (node.type === 'directory') return '\u{1F4C1}'
      const ext = node.name.includes('.') ? node.name.split('.').pop().toLowerCase() : ''
      return FILE_ICONS[ext] || '\u{1F4C4}'
    }

    function reloadTree() {
      if (props.sessionId) fileTreeStore.fetchTree(props.sessionId)
    }

    function handleToggleDirectory(path) {
      if (props.sessionId) fileTreeStore.toggleDirectory(props.sessionId, path)
    }

    function handleIsExpanded(path) {
      return props.sessionId ? fileTreeStore.isExpanded(props.sessionId, path) : false
    }

    function onContextMenu(event, item) {
      ctxMenu.value = {
        show: true,
        x: event.clientX,
        y: event.clientY,
        path: item.node.path,
        fullPath: item.node.path,
        type: item.node.type,
      }
    }

    function closeCtxMenu() {
      ctxMenu.value.show = false
    }

    function copyRelativePath() {
      const rootPath = tree.value ? tree.value.path || '' : ''
      const relativePath = ctxMenu.value.path.startsWith(rootPath + '/')
        ? ctxMenu.value.path.slice(rootPath.length + 1)
        : ctxMenu.value.path
      navigator.clipboard.writeText(relativePath).catch(err => {
        console.error('Error al copiar ruta relativa:', err)
      })
      closeCtxMenu()
    }

    function copyFullPath() {
      navigator.clipboard.writeText(ctxMenu.value.fullPath).catch(err => {
        console.error('Error al copiar ruta completa:', err)
      })
      closeCtxMenu()
    }

    function confirmDeleteFile() {
      const filePath = ctxMenu.value.path
      const fileName = filePath.split('/').pop() || filePath
      const confirmed = confirm(`¿Eliminar archivo "${fileName}"?\n\nRuta: ${filePath}\n\nEsta acción no se puede deshacer.`)
      if (confirmed) {
        deleteFile(filePath)
      }
      closeCtxMenu()
    }

    async function deleteFile(filePath) {
      try {
        const res = await fetch('/api/command/delete-file', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          credentials: 'include',
          body: JSON.stringify({ path: filePath }),
        })
        const data = await res.json()
        if (data.success) {
          if (props.sessionId) {
            selectedFile.value = null
            emit('file-selected', null)
            fileTreeStore.fetchTree(props.sessionId)
          }
        } else {
          modal.open(AlertModal, { message: `Error al eliminar archivo: ${data.error}` }, { title: 'Error' })
        }
      } catch (err) {
        console.error('Error al eliminar archivo:', err)
        modal.open(AlertModal, { message: `Error al eliminar archivo: ${err.message}` }, { title: 'Error' })
      }
    }

    onBeforeUnmount(() => {
      if (clickTimer) clearTimeout(clickTimer)
    })

    watch(() => props.sessionId, (newId) => {
      if (newId) fileTreeStore.fetchTree(newId)
    }, { immediate: true })

    return {
      tree, loading, error, flatTree, selectedFile, ctxMenu,
      getFileIcon, reloadTree, handleToggleDirectory, handleIsExpanded,
      handleSelectFile, handleFileClick, openFile,
      onContextMenu, closeCtxMenu, copyRelativePath, copyFullPath,
      confirmDeleteFile, deleteFile,
    }
  },
}
</script>

<style scoped>
.file-tree-panel {
  font-size: 0.75rem;
  color: #d1d5db;
  min-height: 0;
  overflow: hidden;
}
.tree-header {
  border-bottom: 1px solid #374151;
  white-space: nowrap;
}
.tree-node {
  cursor: default;
  line-height: 1.8;
  white-space: nowrap;
  transition: background 0.1s;
  user-select: none;
}
.tree-node:hover {
  background: rgba(117, 170, 219, 0.08);
}
.tree-node.tree-selected {
  background: rgba(117, 170, 219, 0.18);
}
.tree-node.tree-directory {
  cursor: pointer;
}
.tree-toggle,
.tree-toggle-placeholder {
  width: 14px;
  text-align: center;
  font-size: 0.65rem;
  color: #9ca3af;
  flex-shrink: 0;
}
.tree-icon {
  width: 18px;
  text-align: center;
  font-size: 0.8rem;
  margin-right: 4px;
}
.tree-name {
  color: #d1d5db;
}
.context-menu-backdrop {
  position: fixed;
  top: 0; left: 0; right: 0; bottom: 0;
  z-index: 1040;
}
.context-menu {
  position: fixed;
  z-index: 1050;
  background: #1a2744;
  border: 1px solid #75AADB;
  border-radius: 6px;
  padding: 4px 0;
  min-width: 180px;
  box-shadow: 0 4px 12px rgba(0,0,0,0.4);
}
.context-menu-item {
  padding: 8px 16px;
  cursor: pointer;
  font-size: 0.875rem;
  color: #e0e0e0;
}
.context-menu-item:hover {
  background: #1a2a4e;
}
.context-menu-item.text-danger {
  color: #f87171;
}
.context-menu-item.text-danger:hover {
  background: rgba(248, 113, 113, 0.12);
}
.context-menu-divider {
  height: 1px;
  background: #374151;
  margin: 4px 0;
}
</style>
