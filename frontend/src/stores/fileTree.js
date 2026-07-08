import { defineStore } from 'pinia'
import { ref } from 'vue'

const API = '/api'

export const useFileTreeStore = defineStore('fileTree', () => {
  const trees = ref({})
  const loadingMap = ref({})
  const errorMap = ref({})
  const expandedPathsMap = ref({})

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

  function toggleDirectory(sessionId, path) {
    const paths = { ...(expandedPathsMap.value[sessionId] || {}) }
    if (paths[path]) {
      delete paths[path]
    } else {
      paths[path] = true
    }
    expandedPathsMap.value[sessionId] = paths
  }

  function getFlatTree(sessionId) {
    const treeData = getTree(sessionId)
    if (!treeData || !treeData.children) return []

    const expanded = getExpandedPaths(sessionId)

    function flattenNodes(nodes, depth) {
      if (!nodes || !nodes.length) return []
      const result = []
      for (const node of nodes) {
        result.push({ node, depth })
        if (node.type === 'directory' && expanded[node.path] && node.children) {
          result.push(...flattenNodes(node.children, depth + 1))
        }
      }
      return result
    }

    return flattenNodes(treeData.children, 1)
  }

  async function fetchTree(sessionId) {
    if (!sessionId) return
    loadingMap.value[sessionId] = true
    errorMap.value[sessionId] = null
    trees.value[sessionId] = null
    try {
      const res = await fetch(`${API}/command/arbol-directorios?sessionId=${sessionId}&useGitignore=false&showHidden=true`, {
        credentials: 'include',
      })
      const data = await res.json()
      if (data.success) {
        trees.value[sessionId] = data.tree
        expandedPathsMap.value[sessionId] = {}
      } else {
        errorMap.value[sessionId] = data.error || 'Error al cargar el árbol'
      }
    } catch (err) {
      errorMap.value[sessionId] = err.message || 'Error de conexión'
    } finally {
      loadingMap.value[sessionId] = false
    }
  }

  return {
    getTree, getLoading, getError, getExpandedPaths,
    isExpanded, toggleDirectory, getFlatTree, fetchTree,
  }
})
