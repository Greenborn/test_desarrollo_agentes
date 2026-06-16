<template>
  <div
    class="d-flex flex-column h-100 bg-dark sidebar-chat"
    :class="{ collapsed: sidebarCollapsed }"
  >
    <button class="btn btn-sm mb-2 flex-shrink-0 btn-argentina" @click="createSession" :disabled="creating">
      {{ creating ? 'Creando...' : '＋ Nuevo chat' }}
    </button>
    <button
      class="btn btn-sm w-100 text-start mb-1 flex-shrink-0 btn-outline-argentina"
      data-bs-toggle="collapse"
      data-bs-target="#sidebar-chats-collapse"
    >
      ▼ Chats
    </button>
    <div id="sidebar-chats-collapse" class="collapse show flex-grow-1 overflow-auto">
      <div class="list-group list-group-flush" style="min-height: 0;">
        <button
          v-for="s in sessions"
          :key="s.id"
          class="list-group-item list-group-item-action py-2 px-2 small d-flex justify-content-between align-items-center"
          :class="{ active: s.id === activeSessionId }"
          :title="sessionTooltip(s)"
          @click="selectSession(s.id)"
        >
          <span class="text-truncate">{{ s.title }}</span>
          <span
            class="delete-btn"
            @click.stop="chat.deleteSession(s.id)"
            title="Eliminar conversación"
          >&times;</span>
        </button>
      </div>
    </div>
  </div>
</template>

<script>
import { storeToRefs } from 'pinia'
import { useChatStore } from '../stores/chat.js'
import { useCommandStore } from '../stores/command.js'
import { useUiStore } from '../stores/ui.js'

export default {
  setup() {
    const chat = useChatStore()
    const cmd = useCommandStore()
    const ui = useUiStore()
    const { sessions, activeSessionId, creating } = storeToRefs(chat)
    const { sidebarCollapsed } = storeToRefs(ui)

    function sessionTooltip(s) {
      const lines = []
      if (s.proyecto_descripcion) {
        lines.push(`Proyecto: ${s.proyecto_descripcion}`)
      } else if (s.proyecto_id) {
        lines.push(`Proyecto: ${s.proyecto_id}`)
      }
      if (s.cwd) {
        lines.push(`Directorio: ${s.cwd}`)
      }
      return lines.length ? lines.join('\n') : ''
    }

    function createSession() {
      chat.createSession()
    }

    function selectSession(id) {
      const s = chat.sessions.find((s) => s.id === id)
      if (s && s.cwd) cmd.currentDir = s.cwd
      chat.loadMessages(id)
    }

    return {
      chat,
      sessions,
      activeSessionId,
      creating,
      sidebarCollapsed,
      sessionTooltip,
      createSession,
      selectSession,
    }
  },
}
</script>

<style scoped>
.sidebar-chat {
  width: 220px;
  min-width: 220px;
  padding: 8px;
  border-right: 1px solid #374151;
  transition: width 0.25s ease, min-width 0.25s ease, padding 0.25s ease, border 0.25s ease;
  overflow: hidden;
}
.sidebar-chat.collapsed {
  width: 0;
  min-width: 0;
  padding: 0;
  border: none;
  overflow: hidden;
}
.list-group-item {
  color: #e0e0e0;
  border-color: #374151;
  background-color: transparent;
}
.list-group-item:hover {
  background-color: #1a2744;
}
.list-group-item.active {
  background-color: #1a2a4e !important;
  border-color: #75AADB !important;
  color: #e0e0e0 !important;
  font-weight: 600;
}
.delete-btn {
  display: none;
  cursor: pointer;
  font-size: 1.2rem;
  line-height: 1;
  color: #e05a6b;
  padding: 0 4px;
  margin-left: 4px;
}
.list-group-item:hover .delete-btn {
  display: inline;
}
.btn-argentina {
  background-color: #75AADB;
  color: #fff;
  border: 1px solid #75AADB;
}
.btn-argentina:hover {
  background-color: #5a8fc0;
  color: #fff;
}
.btn-argentina:disabled {
  opacity: 0.6;
}
.btn-outline-argentina {
  background-color: transparent;
  color: #75AADB;
  border: 1px solid #75AADB;
}
.btn-outline-argentina:hover {
  background-color: #1a2744;
  color: #75AADB;
}
</style>
