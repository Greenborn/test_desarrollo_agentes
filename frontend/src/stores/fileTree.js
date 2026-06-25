import { defineStore } from 'pinia'
import { ref, computed } from 'vue'

const API = '/api'

export const useFileTreeStore = defineStore('fileTree', () => {
  const tree = ref(null)
  const loading = ref(false)
  const error = ref(null)
  const expandedPaths = ref({})

  const flatTree = computed(() => {
    if (!tree.value || !tree.value.children) return []

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

    return flattenNodes(tree.value.children, 1)
  })

  function isExpanded(path) {
    return !!expandedPaths.value[path]
  }

  function toggleDirectory(path) {
    const next = { ...expandedPaths.value }
    if (next[path]) {
      delete next[path]
    } else {
      next[path] = true
    }
    expandedPaths.value = next
  }

  async function fetchTree(sessionId) {
    if (!sessionId) return
    loading.value = true
    error.value = null
    tree.value = null
    try {
      const res = await fetch(`${API}/command/arbol-directorios?sessionId=${sessionId}&useGitignore=true&showHidden=true`, {
        credentials: 'include',
      })
      const data = await res.json()
      if (data.success) {
        tree.value = data.tree
        expandedPaths.value = {}
      } else {
        error.value = data.error || 'Error al cargar el árbol'
      }
    } catch (err) {
      error.value = err.message || 'Error de conexión'
    } finally {
      loading.value = false
    }
  }

  return { tree, loading, error, expandedPaths, flatTree, isExpanded, toggleDirectory, fetchTree }
})
