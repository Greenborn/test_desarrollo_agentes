<template>
  <div class="servicios-panel d-flex flex-column h-100">
    <div class="px-2 pt-2 pb-1 flex-shrink-0 d-flex align-items-center justify-content-between">
      <span class="text-white-50" style="font-size: 0.7rem;">Servicios del sistema</span>
      <div class="d-flex align-items-center gap-1">
        <button
          class="btn btn-sm btn-restart-all"
          :disabled="restartingAll"
          @click="store.restartAllServices()"
          title="Reiniciar todos (excepto memoria)"
        >
          <span v-if="restartingAll" class="spinner-border spinner-border-sm" role="status"></span>
          <span v-else>&#x21bb; Todos</span>
        </button>
        <span class="status-dot" :class="allRunning ? 'running' : 'degraded'" :title="allRunning ? 'Todos en ejecución' : 'Algún servicio detenido'"></span>
      </div>
    </div>
    <div class="overflow-y-auto flex-grow-1 px-2" style="min-height: 0;">
      <div v-if="loading && servicios.length === 0" class="text-center text-white-50 py-3" style="font-size: 0.7rem;">
        Cargando...
      </div>
      <div v-else class="service-list">
        <div v-for="svc in servicios" :key="svc.name" class="service-item d-flex align-items-center py-1 px-1 mb-1">
          <span class="service-led" :class="svc.running ? 'running' : 'stopped'" :title="svc.running ? 'En ejecución' : 'Detenido'"></span>
          <div class="d-flex flex-column flex-grow-1 min-width-0 ms-2">
            <span class="service-name text-truncate">{{ svc.name }}</span>
            <span class="service-port text-muted" style="font-size: 0.6rem;">puerto {{ svc.port }}</span>
          </div>
          <button
            class="btn btn-sm btn-restart ms-1"
            :disabled="restarting === svc.name"
            @click="store.restartService(svc.name)"
            :title="`Reiniciar ${svc.name}`"
          >
            <span v-if="restarting === svc.name" class="spinner-border spinner-border-sm" role="status"></span>
            <span v-else>&#x21bb;</span>
          </button>
        </div>
        <div v-if="servicios.length === 0 && !loading" class="text-center text-white-50 py-3" style="font-size: 0.7rem;">
          Sin servicios
        </div>
      </div>
    </div>
  </div>
</template>

<script>
import { computed, onMounted, onUnmounted } from 'vue'
import { storeToRefs } from 'pinia'
import { useServiciosStore } from '../stores/servicios.js'

export default {
  setup() {
    const store = useServiciosStore()
    const { services: servicios, loading, restarting, restartingAll } = storeToRefs(store)

    const allRunning = computed(() => {
      return servicios.value.length > 0 && servicios.value.every(s => s.running)
    })

    onMounted(() => {
      store.startPolling()
    })

    onUnmounted(() => {
      store.stopPolling()
    })

    return { servicios, loading, restarting, restartingAll, allRunning, store }
  },
}
</script>

<style scoped>
.service-list {
  display: flex;
  flex-direction: column;
}
.service-item {
  border-radius: 4px;
  transition: background-color 0.15s;
}
.service-item:hover {
  background-color: #1a2744;
}
.service-led {
  display: inline-block;
  width: 8px;
  height: 8px;
  border-radius: 50%;
  flex-shrink: 0;
  transition: background-color 0.2s ease;
}
.service-led.running {
  background-color: #22c55e;
  box-shadow: 0 0 6px #22c55e;
}
.service-led.stopped {
  background-color: #ef4444;
  box-shadow: 0 0 6px #ef4444;
}
.service-name {
  color: #e0e0e0;
  font-size: 0.75rem;
  line-height: 1.2;
}
.service-port {
  font-size: 0.6rem;
  line-height: 1.2;
}
.btn-restart {
  background: transparent;
  color: #6b7280;
  border: 1px solid #374151;
  font-size: 0.8rem;
  line-height: 1;
  padding: 2px 6px;
  border-radius: 3px;
  transition: color 0.15s, border-color 0.15s;
}
.btn-restart:hover:not(:disabled) {
  color: #75AADB;
  border-color: #75AADB;
}
.btn-restart:disabled {
  opacity: 0.5;
}
.btn-restart-all {
  background: transparent;
  color: #6b7280;
  border: 1px solid #374151;
  font-size: 0.65rem;
  line-height: 1;
  padding: 2px 6px;
  border-radius: 3px;
  transition: color 0.15s, border-color 0.15s;
}
.btn-restart-all:hover:not(:disabled) {
  color: #f59e0b;
  border-color: #f59e0b;
}
.btn-restart-all:disabled {
  opacity: 0.5;
}
.status-dot {
  display: inline-block;
  width: 6px;
  height: 6px;
  border-radius: 50%;
  flex-shrink: 0;
}
.status-dot.running {
  background-color: #22c55e;
  box-shadow: 0 0 4px #22c55e;
}
.status-dot.degraded {
  background-color: #eab308;
  box-shadow: 0 0 4px #eab308;
}
</style>
