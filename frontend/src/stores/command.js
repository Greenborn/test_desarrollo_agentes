import { defineStore } from 'pinia'
import { ref } from 'vue'
import { settingSet, settingGet } from '../services/settingService.js'

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
      const data = await settingGet('last_directory')
      if (data.value) currentDir.value = data.value
    } catch (err) {
      console.error('Error al cargar last_directory:', err)
    }
  }

  async function setDirectory(dir) {
    currentDir.value = dir
    try {
      await settingSet('last_directory', dir)
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

  function reset() {
    currentDir.value = ''
    helpVisible.value = false
    sessionHistory.value = []
    dbHistory.value = []
    autocompleteOptions.value = []
    autocompleteVisible.value = false
    arrowIndex.value = -1
  }

  return {
    currentDir, helpVisible, sessionHistory, dbHistory,
    autocompleteOptions, autocompleteVisible, arrowIndex,
    loadLastDirectory, setDirectory,
    fetchAutocomplete, showAutocomplete, hideAutocomplete,
    loadHistory, pushHistory, resetArrowIndex, reset,
  }
})
