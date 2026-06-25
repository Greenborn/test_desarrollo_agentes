import { defineStore } from 'pinia'
import { ref } from 'vue'

const API = '/api'

export const useAttachmentsStore = defineStore('attachments', () => {
  const items = ref([])
  const loading = ref(false)

  async function fetchByTicket(ticketRedmineId) {
    if (!ticketRedmineId) {
      items.value = []
      return
    }
    loading.value = true
    try {
      const res = await fetch(`${API}/tickets/attachments/by-ticket/${ticketRedmineId}`, { credentials: 'include' })
      const data = await res.json()
      items.value = data.attachments || []
    } catch (err) {
      console.error('Error al obtener adjuntos:', err.message)
      items.value = []
    } finally {
      loading.value = false
    }
  }

  function clear() {
    items.value = []
  }

  return { items, loading, fetchByTicket, clear }
})
