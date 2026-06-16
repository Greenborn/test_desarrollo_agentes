<template>
  <div class="d-flex flex-column vh-100">
    <Topbar />
    <div class="d-flex flex-grow-1 overflow-hidden">
      <SidebarChat />
      <ChatWindow class="flex-grow-1" />
    </div>
    <AppModal />
  </div>
</template>

<script>
import { onMounted, watch } from 'vue'
import Topbar from '../components/Topbar.vue'
import SidebarChat from '../components/SidebarChat.vue'
import ChatWindow from '../components/ChatWindow.vue'
import AppModal from '../components/AppModal.vue'
import { useAuthStore } from '../stores/auth.js'
import { useChatStore } from '../stores/chat.js'
import { useCommandStore } from '../stores/command.js'

export default {
  components: { Topbar, SidebarChat, ChatWindow, AppModal },
  setup() {
    const auth = useAuthStore()
    const chat = useChatStore()
    const cmd = useCommandStore()

    function load() {
      if (auth.user) {
        chat.loadSessions()
        if (chat.activeSessionId) {
          const s = chat.sessions.find((s) => s.id === chat.activeSessionId)
          if (s && s.cwd) cmd.currentDir = s.cwd
        }
      }
    }

    watch(() => auth.user, load)
    onMounted(load)
  },
}
</script>
