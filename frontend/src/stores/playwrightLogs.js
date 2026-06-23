import { defineStore } from 'pinia'
import { ref } from 'vue'

export const usePlaywrightLogsStore = defineStore('playwrightLogs', () => {
  const networkLogs = ref([])
  const consoleLogs = ref([])
  const events = ref([])
  const loading = ref({ network: false, console: false, events: false })
  const eventRecordingName = ref('')

  async function fetchNetworkLogs(chatSessionId) {
    if (!chatSessionId) {
      networkLogs.value = []
      return
    }
    loading.value.network = true
    try {
      const res = await fetch(`/api/playwright-logs/network?chat_session_id=${chatSessionId}`, { credentials: 'include' })
      if (res.ok) {
        networkLogs.value = await res.json()
      }
    } catch (err) {
      console.error('Error fetching network logs:', err.message)
    } finally {
      loading.value.network = false
    }
  }

  async function fetchConsoleLogs(chatSessionId) {
    if (!chatSessionId) {
      consoleLogs.value = []
      return
    }
    loading.value.console = true
    try {
      const res = await fetch(`/api/playwright-logs/console?chat_session_id=${chatSessionId}`, { credentials: 'include' })
      if (res.ok) {
        consoleLogs.value = await res.json()
      }
    } catch (err) {
      console.error('Error fetching console logs:', err.message)
    } finally {
      loading.value.console = false
    }
  }

  async function clearNetworkLogs(chatSessionId) {
    if (!chatSessionId) return
    try {
      const res = await fetch(`/api/playwright-logs/network?chat_session_id=${chatSessionId}`, {
        method: 'DELETE',
        credentials: 'include',
      })
      if (res.ok) {
        networkLogs.value = []
      }
    } catch (err) {
      console.error('Error clearing network logs:', err.message)
    }
  }

  async function fetchEvents(chatSessionId) {
    if (!chatSessionId) {
      events.value = []
      return
    }
    loading.value.events = true
    try {
      const res = await fetch(`/api/playwright-logs/events?chat_session_id=${chatSessionId}`, { credentials: 'include' })
      if (res.ok) {
        events.value = await res.json()
      }
    } catch (err) {
      console.error('Error fetching events:', err.message)
    } finally {
      loading.value.events = false
    }
  }

  async function clearEvents(chatSessionId) {
    if (!chatSessionId) return
    try {
      const res = await fetch(`/api/playwright-logs/events?chat_session_id=${chatSessionId}`, {
        method: 'DELETE',
        credentials: 'include',
      })
      if (res.ok) {
        events.value = []
      }
    } catch (err) {
      console.error('Error clearing events:', err.message)
    }
  }

  async function clearConsoleLogs(chatSessionId) {
    if (!chatSessionId) return
    try {
      const res = await fetch(`/api/playwright-logs/console?chat_session_id=${chatSessionId}`, {
        method: 'DELETE',
        credentials: 'include',
      })
      if (res.ok) {
        consoleLogs.value = []
      }
    } catch (err) {
      console.error('Error clearing console logs:', err.message)
    }
  }

  return {
    networkLogs,
    consoleLogs,
    events,
    loading,
    eventRecordingName,
    fetchNetworkLogs,
    fetchConsoleLogs,
    fetchEvents,
    clearNetworkLogs,
    clearConsoleLogs,
    clearEvents,
  }
})
