import { defineStore } from 'pinia'
import { ref } from 'vue'

export const useTicketStore = defineStore('ticket', () => {
  const tickets = ref([])
  const selectedTicket = ref(null)

  async function loadTickets() {
    try {
      const res = await fetch('/api/tickets', { credentials: 'include' })
      const data = await res.json()
      tickets.value = data.tickets || []
      if (selectedTicket.value) {
        const updated = tickets.value.find(t => t.redmine_id === selectedTicket.value.redmine_id)
        if (updated) selectedTicket.value = updated
      }
    } catch (err) {
      console.error('Error al cargar tickets:', err)
    }
  }

  function selectTicket(ticket) {
    selectedTicket.value = ticket
  }

  function clearSelection() {
    selectedTicket.value = null
  }

  function reset() {
    tickets.value = []
    selectedTicket.value = null
  }

  return { tickets, selectedTicket, loadTickets, selectTicket, clearSelection, reset }
})
