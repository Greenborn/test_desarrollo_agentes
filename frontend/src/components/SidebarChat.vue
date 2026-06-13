<template>
  <div class="d-flex flex-column h-100 bg-light border-end p-2" style="width: 220px; min-width: 220px;">
    <button class="btn btn-primary btn-sm mb-2" @click="createSession">
      ＋ Nuevo chat
    </button>
    <div class="list-group list-group-flush overflow-auto flex-grow-1">
      <button
        v-for="s in sessions"
        :key="s.id"
        class="list-group-item list-group-item-action py-2 px-2 small"
        :class="{ active: s.id === activeSessionId }"
        @click="selectSession(s.id)"
      >
        {{ s.title }}
      </button>
    </div>
  </div>
</template>

<script>
import { useChatStore } from '../stores/chat.js'

export default {
  setup() {
    const chat = useChatStore()

    function createSession() {
      chat.createSession()
    }

    function selectSession(id) {
      chat.loadMessages(id)
    }

    return {
      sessions: chat.sessions,
      activeSessionId: chat.activeSessionId,
      createSession,
      selectSession,
    }
  },
}
</script>
