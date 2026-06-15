import { defineStore } from 'pinia'
import { ref } from 'vue'

const API = '/api'

export const useCommandStore = defineStore('command', () => {
  const currentDir = ref('')
  const helpVisible = ref(false)
  const sessionHistory = ref([])
  const dbHistory = ref([])
  const autocompleteOptions = ref([])
  const autocompleteVisible = ref(false)
  const arrowIndex = ref(-1)

  async function loadLastDirectory() {
    try {
      const res = await fetch(`${API}/command/setting/last_directory`, { credentials: 'include' })
      const data = await res.json()
      if (data.value) currentDir.value = data.value
    } catch (err) {
      console.error('Error al cargar last_directory:', err)
    }
  }

  async function setDirectory(dir) {
    currentDir.value = dir
    try {
      await fetch(`${API}/command/setting`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ key: 'last_directory', value: dir }),
      })
    } catch (err) {
      console.error('Error al guardar directorio:', err)
    }
  }

  async function fetchAutocomplete(prefix, cwd) {
    try {
      let url = `${API}/command/list-directories?prefix=${encodeURIComponent(prefix)}`
      if (cwd) url += `&cwd=${encodeURIComponent(cwd)}`
      const res = await fetch(url, { credentials: 'include' })
      const data = await res.json()
      autocompleteOptions.value = data.directories ? data.directories : []
      autocompleteVisible.value = autocompleteOptions.value.length > 0
      arrowIndex.value = -1
    } catch (err) {
      console.error('Error al obtener autocomplete:', err)
      autocompleteOptions.value = []
      autocompleteVisible.value = false
      arrowIndex.value = -1
    }
  }

  function showAutocomplete(options) {
    autocompleteOptions.value = options
    autocompleteVisible.value = options.length > 0
    arrowIndex.value = -1
  }

  function resetArrowIndex() {
    arrowIndex.value = -1
  }

  function hideAutocomplete() {
    autocompleteVisible.value = false
    autocompleteOptions.value = []
  }

  async function loadHistory(sessionId) {
    try {
      let url = `${API}/command/history?order=asc`
      if (sessionId) url += `&sessionId=${sessionId}`
      const res = await fetch(url, { credentials: 'include' })
      const data = await res.json()
      dbHistory.value = data.history ? data.history.map((h) => h.command) : []
    } catch (err) {
      console.error('Error al cargar historial:', err)
      dbHistory.value = []
    }
  }

  function pushHistory(cmd) {
    sessionHistory.value.unshift(cmd)
    if (sessionHistory.value.length > 100) sessionHistory.value.pop()
  }

  return {
    currentDir, helpVisible, sessionHistory,
    autocompleteOptions, autocompleteVisible, arrowIndex,
    loadLastDirectory, setDirectory,
    fetchAutocomplete, showAutocomplete, hideAutocomplete,
    loadHistory, pushHistory, resetArrowIndex,
  }
})
