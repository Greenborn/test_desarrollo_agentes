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
      <button class="btn btn-sm btn-outline-secondary ms-2 mt-1" @click="fetchTree">Reintentar</button>
    </div>
    <div v-else class="d-flex flex-column h-100">
      <div class="tree-header small text-muted px-2 py-1 flex-shrink-0 text-truncate" :title="tree.path">
        {{ tree.name }}
      </div>
      <div class="tree-scroll overflow-y-auto flex-grow-1" style="min-height: 0;">
        <div
          v-for="item in flatTree"
          :key="item.node.path"
          class="tree-node d-flex align-items-center px-1 py-0"
          :class="{ 'tree-directory': item.node.type === 'directory' }"
          :style="{ paddingLeft: (item.depth * 14 + 8) + 'px' }"
          :title="item.node.path"
          @click="item.node.type === 'directory' ? toggleDirectory(item.node.path) : null"
        >
          <span v-if="item.node.type === 'directory'" class="tree-toggle flex-shrink-0">
            {{ isExpanded(item.node.path) ? '▾' : '▸' }}
          </span>
          <span v-else class="tree-toggle-placeholder flex-shrink-0"></span>
          <span class="tree-icon flex-shrink-0">{{ getFileIcon(item.node) }}</span>
          <span class="tree-name text-truncate small">{{ item.node.name }}</span>
        </div>
      </div>
    </div>
  </div>
</template>

<script>
import { ref, computed, watch } from 'vue'

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
  txt: '\u{1F4C4}',
  log: '\u{1F4C4}',
}

export default {
  props: {
    sessionId: { type: Number, default: null },
  },
  setup(props) {
    const tree = ref(null)
    const loading = ref(true)
    const error = ref(null)
    const expandedPaths = ref(new Set())

    function getFileIcon(node) {
      if (node.type === 'directory') return '\u{1F4C1}'
      const ext = node.name.includes('.') ? node.name.split('.').pop().toLowerCase() : ''
      return FILE_ICONS[ext] || '\u{1F4C4}'
    }

    function isExpanded(path) {
      return expandedPaths.value.has(path)
    }

    function toggleDirectory(path) {
      const s = new Set(expandedPaths.value)
      if (s.has(path)) {
        s.delete(path)
      } else {
        s.add(path)
      }
      expandedPaths.value = s
    }

    function flattenNodes(nodes, depth) {
      if (!nodes || !nodes.length) return []
      const result = []
      for (const node of nodes) {
        result.push({ node, depth })
        if (node.type === 'directory' && isExpanded(node.path) && node.children) {
          result.push(...flattenNodes(node.children, depth + 1))
        }
      }
      return result
    }

    const flatTree = computed(() => {
      if (!tree.value || !tree.value.children) return []
      return flattenNodes(tree.value.children, 1)
    })

    async function fetchTree() {
      if (!props.sessionId) return
      loading.value = true
      error.value = null
      tree.value = null
      try {
        const res = await fetch(`/api/command/arbol-directorios?sessionId=${props.sessionId}&useGitignore=true`, {
          credentials: 'include',
        })
        const data = await res.json()
        if (data.success) {
          tree.value = data.tree
          expandedPaths.value = new Set()
        } else {
          error.value = data.error || 'Error al cargar el árbol'
        }
      } catch (err) {
        error.value = err.message || 'Error de conexión'
      } finally {
        loading.value = false
      }
    }

    watch(() => props.sessionId, (newId) => {
      if (newId) fetchTree()
    }, { immediate: true })

    return {
      tree, loading, error, expandedPaths,
      flatTree, fetchTree,
      getFileIcon, isExpanded, toggleDirectory,
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
</style>
