import { defineStore } from 'pinia'
import { ref, onUnmounted } from 'vue'

export const useServiciosStore = defineStore('servicios', () => {
  const services = ref([])
  const loading = ref(false)
  const restarting = ref(null)
  const restartingAll = ref(false)
  const error = ref(null) // { type: 'network' | 'server', message: string } | null

  let pollingTimer = null

  async function fetchServices() {
    loading.value = true
    try {
      const res = await fetch('/api/gestor/services', { credentials: 'include' })
      if (!res.ok) {
        let message = `Error ${res.status}`
        try {
          const body = await res.json()
          if (body?.error) message = body.error
        } catch (err) {
          console.log('[servicios] No se pudo parsear la respuesta de error del gestor:', err.message)
        }
        console.error('[servicios] Error al obtener servicios:', message)
        error.value = { type: 'server', message }
        return
      }
      const data = await res.json()
      services.value = data.services || []
      error.value = null
    } catch (err) {
      console.error('[servicios] Error al obtener servicios:', err.message)
      error.value = { type: 'network', message: 'No se pudo contactar al gestor de servicios' }
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

  async function restartAllServices() {
    restartingAll.value = true
    try {
      const res = await fetch('/api/gestor/services/restart-all', {
        method: 'POST',
        credentials: 'include',
      })
      const data = await res.json()
      if (data.success) {
        setTimeout(() => fetchServices(), 1500)
      }
      return data
    } catch (err) {
      console.error('[servicios] Error al reiniciar todos los servicios:', err.message)
    } finally {
      restartingAll.value = false
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

  function reset() {
    stopPolling()
    services.value = []
    loading.value = false
    restarting.value = null
    restartingAll.value = false
    error.value = null
  }

  return { services, loading, restarting, restartingAll, error, fetchServices, restartService, restartAllServices, startPolling, stopPolling, reset }
})
