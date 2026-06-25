import { defineStore } from 'pinia'
import { ref } from 'vue'

const API = '/api'

export const useGitStore = defineStore('git', () => {
  const isGitRepo = ref(false)
  const repoPath = ref('')
  const cwd = ref('')
  const currentBranch = ref(null)
  const branches = ref([])
  const tags = ref([])
  const structuredCommits = ref([])
  const gitZoom = ref(100)
  const chatZoom = ref(100)
  const loading = ref(false)

  async function fetchRepoData(sessionId) {
    if (!sessionId) {
      loading.value = false
      isGitRepo.value = false
      cwd.value = ''
      return
    }
    loading.value = true
    try {
      const verifyRes = await fetch(`${API}/command/git-verify`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ sessionId }),
      })
      const verifyData = await verifyRes.json()

      if (!verifyData.isRepo) {
        isGitRepo.value = false
        loading.value = false
        return
      }

      isGitRepo.value = true
      repoPath.value = verifyData.rootPath || ''

      const structRes = await fetch(`${API}/command/git-log-structured`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ sessionId, maxCount: 100 }),
      })
      const structData = await structRes.json()

      if (structData.success) {
        structuredCommits.value = structData.commits
        branches.value = structData.branches || []
        const current = structData.branches.find(b => b.isCurrent)
        currentBranch.value = current ? current.name : null
        tags.value = structData.tags || []
      }
    } catch (err) {
      console.error('Error al obtener datos del repositorio:', err)
      isGitRepo.value = false
    } finally {
      loading.value = false
    }
  }

  async function fetchGitBranch(sessionId) {
    if (!sessionId) {
      currentBranch.value = null
      return
    }
    try {
      const verifyRes = await fetch(`${API}/command/git-verify`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ sessionId }),
      })
      const verifyData = await verifyRes.json()
      if (!verifyData.isRepo) {
        currentBranch.value = 'Sin repo'
        return
      }
      const branchRes = await fetch(`${API}/command/git`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ command: 'rev-parse --abbrev-ref HEAD', sessionId }),
      })
      const branchData = await branchRes.json()
      if (branchData.success && branchData.stdout) {
        currentBranch.value = branchData.stdout.trim()
      } else {
        currentBranch.value = 'HEAD'
      }
    } catch (err) {
      console.error('Error al obtener rama actual:', err.message)
      currentBranch.value = 'Sin repo'
    }
  }

  async function runGitCommand(sessionId, command) {
    const res = await fetch(`${API}/command/git`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      credentials: 'include',
      body: JSON.stringify({ command, sessionId }),
    })
    return res.json()
  }

  async function fetchBranches(sessionId) {
    try {
      const res = await fetch(`${API}/command/git-list-branches`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ sessionId }),
      })
      return res.json()
    } catch (err) {
      console.error('Error al listar ramas:', err.message)
      return { branches: [], current: null }
    }
  }

  async function loadZoom(type) {
    const key = type === 'chat' ? 'chat_zoom' : 'git_graph_zoom'
    try {
      const res = await fetch(`${API}/command/setting/${key}`, { credentials: 'include' })
      const data = await res.json()
      if (data.value !== null && data.value !== undefined) {
        const val = parseInt(data.value, 10) || 100
        if (type === 'chat') chatZoom.value = val
        else gitZoom.value = val
      }
    } catch (err) {
      console.error(`Error al cargar zoom (${key}):`, err)
    }
  }

  async function saveZoom(type, val) {
    const key = type === 'chat' ? 'chat_zoom' : 'git_graph_zoom'
    try {
      await fetch(`${API}/command/setting`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ key, value: String(val) }),
      })
    } catch (err) {
      console.error(`Error al guardar zoom (${key}):`, err)
    }
  }

  function zoomIn(type) {
    const current = type === 'chat' ? chatZoom.value : gitZoom.value
    const val = Math.min(200, current + 10)
    if (type === 'chat') chatZoom.value = val
    else gitZoom.value = val
    saveZoom(type, val)
  }

  function zoomOut(type) {
    const current = type === 'chat' ? chatZoom.value : gitZoom.value
    const val = Math.max(50, current - 10)
    if (type === 'chat') chatZoom.value = val
    else gitZoom.value = val
    saveZoom(type, val)
  }

  function resetZoom(type) {
    if (type === 'chat') chatZoom.value = 100
    else gitZoom.value = 100
    saveZoom(type, 100)
  }

  function setCwd(path) {
    cwd.value = path
  }

  return {
    isGitRepo, repoPath, cwd, currentBranch, branches, tags,
    structuredCommits, gitZoom, chatZoom, loading,
    fetchRepoData, fetchGitBranch, runGitCommand, fetchBranches,
    loadZoom, saveZoom, zoomIn, zoomOut, resetZoom, setCwd,
  }
})
