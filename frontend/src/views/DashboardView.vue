<template>
  <div class="d-flex flex-column vh-100">
    <Topbar />
    <div class="d-flex flex-grow-1 overflow-hidden">
      <SidebarChat />
      <TicketDetail v-if="selectedTicket" class="flex-grow-1" />
      <ProjectDetail v-else-if="selectedProject" class="flex-grow-1" />
      <ChatWindow v-else class="flex-grow-1" />
    </div>
    <div class="bottom-panel" :class="{ collapsed: panelCollapsed }">
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
import TicketDetail from '../components/TicketDetail.vue'
import AppModal from '../components/AppModal.vue'
import { useAuthStore } from '../stores/auth.js'
import { useChatStore } from '../stores/chat.js'
import { useCommandStore } from '../stores/command.js'
import { useProjectStore } from '../stores/project.js'
import { useTicketStore } from '../stores/ticket.js'
import { useUiStore } from '../stores/ui.js'

export default {
  components: { Topbar, SidebarChat, ChatWindow, ProjectDetail, TicketDetail, AppModal },
  setup() {
    const auth = useAuthStore()
    const chat = useChatStore()
    const cmd = useCommandStore()
    const projectStore = useProjectStore()
    const ticketStore = useTicketStore()
    const ui = useUiStore()
    const { panelCollapsed } = storeToRefs(ui)
    const { selectedProject } = storeToRefs(projectStore)
    const { selectedTicket } = storeToRefs(ticketStore)

    function load() {
      if (auth.user) {
        chat.loadSessions()
        projectStore.loadProjects()
        ticketStore.loadTickets()
      }
    }

    watch(() => auth.user?.workspaceId, (newId, oldId) => {
      if (newId && newId !== oldId) {
        projectStore.clearSelection()
        ticketStore.clearSelection()
        chat.stopAllExecutions()
        load()
      }
    })

    watch(() => auth.user, load)
    onMounted(load)

    return { selectedProject, selectedTicket, panelCollapsed }
  },
}
</script>

<style scoped>
.bottom-panel {
  height: 30vh;
  overflow: hidden;
  transition: height 0.25s ease;
  background: #1a1a2e;
  border-top: 1px solid #374151;
}
.bottom-panel.collapsed {
  height: 0;
  border: none;
}
</style>
