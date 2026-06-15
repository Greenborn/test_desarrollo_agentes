<template>
  <div
    class="d-flex flex-column h-100 bg-dark sidebar-chat"
    :class="{ collapsed: sidebarCollapsed }"
  >
    <button class="btn btn-primary btn-sm mb-2 flex-shrink-0" @click="createSession" :disabled="creating">
      {{ creating ? 'Creando...' : '＋ Nuevo chat' }}
    </button>
    <div class="list-group list-group-flush overflow-auto flex-grow-1 bg-dark">
      <button
        v-for="s in sessions"
        :key="s.id"
        class="list-group-item list-group-item-action py-2 px-2 small d-flex justify-content-between align-items-center bg-dark text-light border-secondary"
        :class="{ active: s.id === activeSessionId }"
        @click="selectSession(s.id)"
      >
        <span class="text-truncate text-light">{{ s.title }}</span>
        <span
          class="delete-btn"
          @click.stop="chat.deleteSession(s.id)"
          title="Eliminar conversación"
        >&times;</span>
      </button>
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
  border-right: 1px solid var(--bs-border-secondary, #6c757d);
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
</style>
