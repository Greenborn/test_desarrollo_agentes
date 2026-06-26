import { defineStore } from 'pinia'
import { ref, onUnmounted } from 'vue'

export const useServiciosStore = defineStore('servicios', () => {
  const services = ref([])
  const loading = ref(false)
  const restarting = ref(null)

  let pollingTimer = null

  async function fetchServices() {
    loading.value = true
    try {
      const res = await fetch('/api/gestor/services', { credentials: 'include' })
      if (!res.ok) {
        console.error('[servicios] Error al obtener servicios:', res.status)
        return
      }
      const data = await res.json()
      services.value = data.services || []
    } catch (err) {
      console.error('[servicios] Error al obtener servicios:', err.message)
    } finally {
      loading.value = false
    }
  }

  async function restartService(name) {
    restarting.value = name
    try {
      const res = await fetch(`/api/gestor/services/${encodeURIComponent(name)}/restart`, {
        method: 'POST',
        credentials: 'include',
      })
      const data = await res.json()
      if (data.success) {
        setTimeout(() => fetchServices(), 1000)
      }
      return data
    } catch (err) {
      console.error('[servicios] Error al reiniciar servicio:', err.message)
    } finally {
      restarting.value = null
    }
  }

  function startPolling() {
    fetchServices()
    pollingTimer = setInterval(fetchServices, 5000)
  }

  function stopPolling() {
    if (pollingTimer) {
      clearInterval(pollingTimer)
      pollingTimer = null
    }
  }

  return { services, loading, restarting, fetchServices, restartService, startPolling, stopPolling }
})
