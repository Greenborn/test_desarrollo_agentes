import { defineStore } from 'pinia'
import { ref } from 'vue'

export const usePlaywrightLogsStore = defineStore('playwrightLogs', () => {
  const networkLogs = ref([])
  const consoleLogs = ref([])
  const events = ref([])
  const recordings = ref([])
  const recordingEvents = ref([])
  const loading = ref({ network: false, console: false, events: false, recordings: false, recordingEvents: false })
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

  const uncategorizedCount = ref(0)

  async function fetchRecordings(projectId) {
    const query = projectId ? `?project_id=${encodeURIComponent(projectId)}` : ''
    loading.value.recordings = true
    try {
      const res = await fetch(`/api/playwright-logs/event-recordings${query}`, { credentials: 'include' })
      if (res.ok) {
        const data = await res.json()
        recordings.value = data.recordings || []
        uncategorizedCount.value = data.uncategorizedCount || 0
      }
    } catch (err) {
      console.error('Error fetching recordings:', err.message)
    } finally {
      loading.value.recordings = false
    }
  }

  async function fetchRecordingEvents(recordingId) {
    const query = recordingId === null || recordingId === undefined
      ? 'recording_id=none'
      : `recording_id=${recordingId}`
    loading.value.recordingEvents = true
    try {
      const res = await fetch(`/api/playwright-logs/events?${query}`, { credentials: 'include' })
      if (res.ok) {
        recordingEvents.value = await res.json()
      }
    } catch (err) {
      console.error('Error fetching recording events:', err.message)
    } finally {
      loading.value.recordingEvents = false
    }
  }

  async function createEventRecording({ name, chatSessionId, projectId }) {
    const res = await fetch('/api/playwright-logs/event-recordings', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      credentials: 'include',
      body: JSON.stringify({ name, chat_session_id: chatSessionId, project_id: projectId || null }),
    })
    const data = await res.json()
    if (!res.ok) {
      throw new Error(data.error || 'Error al crear grabación')
    }
    return data
  }

  async function updateRecording(id, data) {
    const res = await fetch(`/api/playwright-logs/event-recordings/${id}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      credentials: 'include',
      body: JSON.stringify(data),
    })
    if (!res.ok) {
      const err = await res.json()
      throw new Error(err.error || 'Error al actualizar grabación')
    }
    const updated = await res.json()
    const idx = recordings.value.findIndex(r => r.id === id)
    if (idx >= 0) {
      recordings.value[idx] = updated
    }
    return updated
  }

  async function cloneRecording(id) {
    const res = await fetch(`/api/playwright-logs/event-recordings/${id}/clone`, {
      method: 'POST',
      credentials: 'include',
    })
    if (!res.ok) {
      const err = await res.json()
      throw new Error(err.error || 'Error al clonar grabación')
    }
    const cloned = await res.json()
    recordings.value.push(cloned)
    return cloned
  }

  async function deleteRecording(id) {
    const res = await fetch(`/api/playwright-logs/event-recordings/${id}`, {
      method: 'DELETE',
      credentials: 'include',
    })
    if (!res.ok) {
      const data = await res.json()
      throw new Error(data.error || 'Error al eliminar grabación')
    }
    recordings.value = recordings.value.filter(r => r.id !== id)
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
    recordings,
    recordingEvents,
    uncategorizedCount,
    loading,
    eventRecordingName,
    fetchNetworkLogs,
    fetchConsoleLogs,
    fetchEvents,
    clearNetworkLogs,
    clearConsoleLogs,
    clearEvents,
    fetchRecordings,
    fetchRecordingEvents,
    createEventRecording,
    updateRecording,
    cloneRecording,
    deleteRecording,
  }
})
