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
import { onMounted } from 'vue'
import Topbar from '../components/Topbar.vue'
import SidebarChat from '../components/SidebarChat.vue'
import ChatWindow from '../components/ChatWindow.vue'
import { useChatStore } from '../stores/chat.js'

export default {
  components: { Topbar, SidebarChat, ChatWindow },
  setup() {
    const chat = useChatStore()
    onMounted(() => chat.loadSessions())
  },
}
</script>
