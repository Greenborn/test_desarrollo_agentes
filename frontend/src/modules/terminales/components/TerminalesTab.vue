<template>
  <div class="h-100 d-flex flex-column" style="min-height: 0;">
    <div class="d-flex align-items-center px-2 py-1 flex-shrink-0 border-bottom border-secondary">
      <label class="d-flex align-items-center gap-1 small text-secondary" style="font-size: 0.7rem; cursor: pointer;">
        <input type="checkbox" v-model="filterBySession" class="form-check-input m-0" style="cursor: pointer; width: 14px; height: 14px;" />
        Solo sesión actual
      </label>
    </div>

    <div v-if="!activeSessionId" class="d-flex flex-column align-items-center justify-content-center flex-grow-1 text-secondary small px-3 text-center">
      <span>Seleccione una sesión de chat</span>
    </div>
    <div v-else-if="displayTerminals.length === 0" class="d-flex flex-column align-items-center justify-content-center flex-grow-1 text-secondary small px-3 text-center">
      <span>Sin terminales activas</span>
    </div>
    <div v-else class="terminales-list flex-grow-1 overflow-y-auto px-2 py-1">
      <div v-for="t in displayTerminals" :key="(t._sessionId || activeSessionId) + '-' + t._key" class="terminal-item d-flex flex-column px-2 py-2 mb-1 rounded">
        <div v-if="!filterBySession && t._sessionId && Number(t._sessionId) !== Number(activeSessionId)" class="d-flex gap-1 flex-wrap mb-1">
          <span class="badge" style="font-size: 0.55rem; background: rgba(117, 170, 219, 0.15); color: #75AADB; border: 1px solid rgba(117, 170, 219, 0.3);">🌐 {{ getWorkspaceName(t._sessionId) }}</span>
          <span class="badge" style="font-size: 0.55rem; background: rgba(168, 130, 255, 0.15); color: #A882FF; border: 1px solid rgba(168, 130, 255, 0.3);">🎫 {{ getSessionTicket(t._sessionId) }}</span>
          <span class="badge" style="font-size: 0.55rem; background: rgba(52, 211, 153, 0.15); color: #34d399; border: 1px solid rgba(52, 211, 153, 0.3);">📋 {{ getSessionProject(t._sessionId) }}</span>
        </div>
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
  </div>
</template>

<script>
import { ref, computed } from 'vue'
import { storeToRefs } from 'pinia'
import { useChatStore } from '../../../stores/chat.js'
import { useWorkspaceStore } from '../../../stores/workspace.js'

export default {
  setup() {
    const chat = useChatStore()
    const workspaceStore = useWorkspaceStore()
    const { activeSessionId } = storeToRefs(chat)

    const filterBySession = ref(true)

    const displayTerminals = computed(() => {
      if (filterBySession.value) {
        const sid = activeSessionId.value
        if (!sid) return []
        return chat.getTerminals(sid)
      }
      const entries = []
      const terminalSessions = chat._terminalSessions || {}
      for (const [sid, terminals] of Object.entries(terminalSessions)) {
        if (!Array.isArray(terminals)) continue
        entries.push(...terminals.map(t => ({ ...t, _sessionId: sid })))
      }
      return entries
    })

    function getSessionInfo(sid) {
      return chat.sessions.find(s => Number(s.id) === Number(sid)) || null
    }

    function getWorkspaceName(sid) {
      const session = getSessionInfo(sid)
      if (!session) return '—'
      const ws = workspaceStore.workspaces.find(w => Number(w.id) === Number(session.workspace_id))
      return ws ? ws.name : 'ID:' + session.workspace_id
    }

    function getSessionTicket(sid) {
      const session = getSessionInfo(sid)
      if (!session) return '—'
      return session.id_ticket_redmine ? '#' + session.id_ticket_redmine : '—'
    }

    function getSessionProject(sid) {
      const session = getSessionInfo(sid)
      if (!session) return '—'
      return session.proyecto_descripcion || '—'
    }

    async function cerrarTerminal(t) {
      const sid = t._sessionId || activeSessionId.value
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

      const targetSession = chat._terminalSessions[sid]
      if (targetSession) {
        if (t.terminalId) {
          const idx = targetSession.findIndex(term => term.terminalId === t.terminalId)
          if (idx >= 0) {
            targetSession.splice(idx, 1)
          }
        } else {
          targetSession.pop()
        }
        if (targetSession.length === 0) {
          delete chat._terminalSessions[sid]
        }
      }
    }

    return {
      activeSessionId,
      filterBySession,
      displayTerminals,
      cerrarTerminal,
      getWorkspaceName,
      getSessionTicket,
      getSessionProject,
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
