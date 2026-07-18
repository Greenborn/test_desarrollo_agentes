import { defineStore } from 'pinia'
import { ref, reactive } from 'vue'

const API = '/api'

export const useTicketFormStore = defineStore('ticketForm', () => {
  const options = reactive({
    statuses: [],
    priorities: [],
    trackers: [],
    users: [],
  })
  const allowedStatuses = ref([])
  const loading = ref(false)

  async function loadOptions() {
    loading.value = true
    try {
      const res = await fetch(`${API}/tickets/options`, { credentials: 'include' })
      const data = await res.json()
      options.statuses = data.statuses || []
      options.priorities = data.priorities || []
      options.trackers = data.trackers || []
      options.users = data.users || []
    } catch (err) {
      console.error('Error al cargar opciones generales:', err)
    } finally {
      loading.value = false
    }

    if (options.statuses.length === 0) {
      options.statuses = [
        { id: null, name: 'Nuevo' },
        { id: null, name: 'En Progreso' },
        { id: null, name: 'Resuelto' },
        { id: null, name: 'Feedback' },
        { id: null, name: 'Cerrado' },
        { id: null, name: 'Rechazado' },
      ]
    }
    if (options.priorities.length === 0) {
      options.priorities = [
        { id: null, name: 'Baja' },
        { id: null, name: 'Normal' },
        { id: null, name: 'Alta' },
        { id: null, name: 'Urgente' },
        { id: null, name: 'Inmediata' },
      ]
    }
    if (options.trackers.length === 0) {
      options.trackers = [
        { id: null, name: 'Bug' },
        { id: null, name: 'Feature' },
        { id: null, name: 'Support' },
        { id: null, name: 'Task' },
      ]
    }
  }

  async function loadTicketOptions(redmineId) {
    if (!redmineId) return
    try {
      const res = await fetch(`${API}/tickets/ticket-options/${redmineId}`, { credentials: 'include' })
      const data = await res.json()
      if (data.statuses && data.statuses.length > 0) {
        allowedStatuses.value = data.statuses
      }
      if (data.priorities && data.priorities.length > 0) {
        options.priorities = data.priorities
      }
      if (data.users && data.users.length > 0) {
        options.users = data.users
      }
    } catch (err) {
      console.error('Error al cargar opciones del ticket:', err)
    }
  }

  async function loadProjectUsers(projectId) {
    if (!projectId) return
    try {
      const res = await fetch(`${API}/tickets/project-members/${projectId}`, { credentials: 'include' })
      const data = await res.json()
      if (data.users && data.users.length > 0) {
        options.users = data.users
      }
    } catch (err) {
      console.error('Error al cargar miembros del proyecto:', err)
    }
  }

  function clear() {
    options.statuses = []
    options.priorities = []
    options.trackers = []
    options.users = []
    allowedStatuses.value = []
  }

  function reset() {
    options.statuses = []
    options.priorities = []
    options.trackers = []
    options.users = []
    allowedStatuses.value = []
    loading.value = false
  }

  return { options, allowedStatuses, loading, loadOptions, loadTicketOptions, loadProjectUsers, clear, reset }
})
