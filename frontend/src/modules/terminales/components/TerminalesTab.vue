<template>
  <div v-if="!activeSessionId" class="d-flex flex-column align-items-center justify-content-center flex-grow-1 text-secondary small px-3 text-center">
    <span>Seleccione una sesión de chat</span>
  </div>
  <div v-else-if="terminales.length === 0" class="d-flex flex-column align-items-center justify-content-center flex-grow-1 text-secondary small px-3 text-center">
    <span>Sin terminales activas</span>
  </div>
  <div v-else class="terminales-list flex-grow-1 overflow-y-auto px-2 py-1">
    <div v-for="t in terminales" :key="t._key" class="terminal-item d-flex flex-column px-2 py-2 mb-1 rounded">
      <div class="d-flex align-items-center gap-1 mb-1">
        <span class="terminal-label small fw-semibold text-truncate">{{ t.label || 'terminal' }}</span>
        <span class="terminal-status ms-auto" :class="t.terminalId ? 'status-active' : 'status-pending'">
          {{ t.terminalId ? 'activa' : 'pendiente' }}
        </span>
      </div>
      <div v-if="t.terminalId" class="terminal-info text-muted small mb-1" style="font-size: 0.6rem; font-family: monospace;">
        ID: {{ t.terminalId.substring(0, 12) }}…
      </div>
      <div v-if="t.cwd" class="terminal-info text-muted small text-truncate mb-1" style="font-size: 0.6rem;">
        📁 {{ t.cwd }}
      </div>
      <div v-if="t.initCommand" class="terminal-info text-muted small text-truncate mb-2" style="font-size: 0.6rem; font-family: monospace;">
        $ {{ t.initCommand }}
      </div>
      <div class="d-flex gap-1 justify-content-end">
        <button class="btn btn-sm btn-outline-danger py-0 px-2" style="font-size: 0.65rem;" @click.stop="cerrarTerminal(t)">✕ Cerrar</button>
      </div>
    </div>
  </div>
</template>

<script>
import { computed } from 'vue'
import { storeToRefs } from 'pinia'
import { useChatStore } from '../../../stores/chat.js'

export default {
  setup() {
    const chat = useChatStore()
    const { activeSessionId } = storeToRefs(chat)

    const terminales = computed(() => {
      const sid = activeSessionId.value
      if (!sid) return []
      return chat.getTerminals(sid)
    })

    async function cerrarTerminal(t) {
      const sid = activeSessionId.value
      if (!sid) return
      if (t.terminalId) {
        try {
          await fetch(`/api/procesos/terminal/${t.terminalId}`, {
            method: 'DELETE',
            credentials: 'include',
          })
        } catch (err) {
          console.error('Error al cerrar terminal en servidor:', err)
        }
      }
      chat.closeTerminal(t.terminalId)
    }

    return {
      activeSessionId,
      terminales,
      cerrarTerminal,
    }
  },
}
</script>

<style scoped>
.terminales-list {
  background: #16213e;
}
.terminal-item {
  background: #1a2744;
  border: 1px solid #374151;
}
.terminal-item:hover {
  background: #1e3050;
}
.terminal-label {
  color: #75AADB;
  font-size: 0.7rem;
}
.terminal-status {
  font-size: 0.55rem;
  padding: 1px 6px;
  border-radius: 8px;
}
.status-active {
  color: #22c55e;
  background: rgba(34, 197, 94, 0.12);
}
.status-pending {
  color: #eab308;
  background: rgba(234, 179, 8, 0.12);
}
.terminal-info {
  line-height: 1.3;
  color: #6b7280;
}
</style>
