import { defineStore } from 'pinia'
import { ref } from 'vue'

const API = '/api'

export const useFileTreeStore = defineStore('fileTree', () => {
  const trees = ref({})
  const loadingMap = ref({})
  const errorMap = ref({})
  const expandedPathsMap = ref({})
  const loadedPaths = ref({})
  const loadingChildrenMap = ref({})

  function getTree(sessionId) {
    return trees.value[sessionId] || null
  }

  function getLoading(sessionId) {
    return !!loadingMap.value[sessionId]
  }

  function getError(sessionId) {
    return errorMap.value[sessionId] || null
  }

  function getExpandedPaths(sessionId) {
    return expandedPathsMap.value[sessionId] || {}
  }

  function isExpanded(sessionId, path) {
    const paths = expandedPathsMap.value[sessionId]
    return paths ? !!paths[path] : false
  }

  function isChildrenLoaded(sessionId, path) {
    return !!(loadedPaths.value[sessionId]?.[path])
  }

  function isLoadingChildren(sessionId, path) {
    return !!(loadingChildrenMap.value[sessionId]?.[path])
  }

  function getFlatTree(sessionId) {
    const treeData = getTree(sessionId)
    if (!treeData || !treeData.children) return []

    const expanded = getExpandedPaths(sessionId)

    function flattenNodes(nodes, depth) {
      if (!nodes || !nodes.length) return []
      const sorted = [...nodes].sort((a, b) => {
        if (a.type !== b.type) return a.type === 'directory' ? -1 : 1
        return a.name.localeCompare(b.name)
      })
      const result = []
      for (const node of sorted) {
        result.push({ node, depth })
        if (node.type === 'directory' && expanded[node.path] && node.children) {
          result.push(...flattenNodes(node.children, depth + 1))
        }
      }
      return result
    }

    return flattenNodes(treeData.children, 1)
  }

  function _insertChildren(tree, dirPath, children) {
    if (!tree) return false
    if (tree.path === dirPath) {
      tree.children = children
      return true
    }
    if (tree.children) {
      for (const child of tree.children) {
        if (_insertChildren(child, dirPath, children)) return true
      }
    }
    return false
  }

  async function fetchChildren(sessionId, dirPath) {
    if (!sessionId || !dirPath) return
    if (!loadingChildrenMap.value[sessionId]) loadingChildrenMap.value[sessionId] = {}
    loadingChildrenMap.value[sessionId][dirPath] = true
    try {
      const res = await fetch(
        `${API}/command/arbol-directorios?sessionId=${sessionId}&dir=${encodeURIComponent(dirPath)}&depth=1&useGitignore=false&showHidden=true`,
        { credentials: 'include' }
      )
      const data = await res.json()
      if (data.success && data.tree && data.tree.children) {
        _insertChildren(trees.value[sessionId], dirPath, data.tree.children)
        if (!loadedPaths.value[sessionId]) loadedPaths.value[sessionId] = {}
        loadedPaths.value[sessionId][dirPath] = true
      } else {
        console.error('Error al cargar hijos del directorio:', data.error)
      }
    } catch (err) {
      console.error('Error al cargar hijos del directorio:', err.message)
    } finally {
      loadingChildrenMap.value[sessionId][dirPath] = false
    }
  }

  async function toggleDirectory(sessionId, path) {
    const paths = { ...(expandedPathsMap.value[sessionId] || {}) }
    if (paths[path]) {
      delete paths[path]
      expandedPathsMap.value[sessionId] = paths
      return
    }
    if (!isChildrenLoaded(sessionId, path)) {
      await fetchChildren(sessionId, path)
    }
    paths[path] = true
    expandedPathsMap.value[sessionId] = paths
  }

  async function fetchTree(sessionId) {
    if (!sessionId) return
    loadingMap.value[sessionId] = true
    errorMap.value[sessionId] = null
    trees.value[sessionId] = null
    expandedPathsMap.value[sessionId] = {}
    loadedPaths.value[sessionId] = {}
    loadingChildrenMap.value[sessionId] = {}
    try {
      const res = await fetch(
        `${API}/command/arbol-directorios?sessionId=${sessionId}&depth=1&useGitignore=false&showHidden=true`,
        { credentials: 'include' }
      )
      const data = await res.json()
      if (data.success) {
        trees.value[sessionId] = data.tree
        loadedPaths.value[sessionId][data.tree.path] = true
      } else {
        errorMap.value[sessionId] = data.error || 'Error al cargar el árbol'
      }
    } catch (err) {
      errorMap.value[sessionId] = err.message || 'Error de conexión'
    } finally {
      loadingMap.value[sessionId] = false
    }
  }

  function reset() {
    trees.value = {}
    loadingMap.value = {}
    errorMap.value = {}
    expandedPathsMap.value = {}
    loadedPaths.value = {}
    loadingChildrenMap.value = {}
  }

  return {
    getTree, getLoading, getError, getExpandedPaths,
    isExpanded, isChildrenLoaded, isLoadingChildren,
    getFlatTree, fetchTree, toggleDirectory, fetchChildren, reset,
  }
})
