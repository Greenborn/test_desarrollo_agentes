<template>
  <div class="d-flex flex-column vh-100">
    <Topbar />
    <div class="d-flex flex-grow-1 overflow-hidden">
      <SidebarChat />
      <ChatWindow v-if="!selectedProject" class="flex-grow-1" />
      <ProjectDetail v-else class="flex-grow-1" />
    </div>
    <AppModal />
  </div>
</template>

<script>
import { onMounted, watch } from 'vue'
import { storeToRefs } from 'pinia'
import Topbar from '../components/Topbar.vue'
import SidebarChat from '../components/SidebarChat.vue'
import ChatWindow from '../components/ChatWindow.vue'
import ProjectDetail from '../components/ProjectDetail.vue'
import AppModal from '../components/AppModal.vue'
import { useAuthStore } from '../stores/auth.js'
import { useChatStore } from '../stores/chat.js'
import { useCommandStore } from '../stores/command.js'
import { useProjectStore } from '../stores/project.js'

export default {
  components: { Topbar, SidebarChat, ChatWindow, ProjectDetail, AppModal },
  setup() {
    const auth = useAuthStore()
    const chat = useChatStore()
    const cmd = useCommandStore()
    const projectStore = useProjectStore()
    const { selectedProject } = storeToRefs(projectStore)

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

    return { selectedProject }
  },
}
</script>
