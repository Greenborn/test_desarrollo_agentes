<template>
  <div class="d-flex flex-column vh-100">
    <Topbar />
    <div class="d-flex flex-grow-1 overflow-hidden">
      <SidebarChat />
      <ChatWindow class="flex-grow-1" />
    </div>
  </div>
</template>

<script>
import { onMounted, watch } from 'vue'
import Topbar from '../components/Topbar.vue'
import SidebarChat from '../components/SidebarChat.vue'
import ChatWindow from '../components/ChatWindow.vue'
import { useAuthStore } from '../stores/auth.js'
import { useChatStore } from '../stores/chat.js'

export default {
  components: { Topbar, SidebarChat, ChatWindow },
  setup() {
    const auth = useAuthStore()
    const chat = useChatStore()

    function load() {
      if (auth.user) chat.loadSessions()
    }

    watch(() => auth.user, load)
    onMounted(load)
  },
}
</script>
