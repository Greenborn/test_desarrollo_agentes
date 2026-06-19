<template>
  <div class="d-flex flex-column vh-100">
    <Topbar />
    <div class="d-flex flex-grow-1 overflow-hidden">
      <SidebarChat />
      <TicketDetail v-if="selectedTicket" class="flex-grow-1" />
      <ProjectDetail v-else-if="selectedProject" class="flex-grow-1" />
      <ChatWindow v-else class="flex-grow-1" />
    </div>
    <div
      class="bottom-panel"
      :class="{ collapsed: panelCollapsed, transitioning: isTransitioning }"
      :style="{ height: panelCollapsed ? '0' : panelHeight + 'px' }"
    >
      <div class="panel-resize-handle" @mousedown.prevent="startResize">
        <div class="panel-resize-handle-bar"></div>
      </div>
      <DevInstancePanel />
    </div>
    <AppModal />
  </div>
</template>

<script>
import { onMounted, watch, ref } from 'vue'
import { storeToRefs } from 'pinia'
import Topbar from '../components/Topbar.vue'
import SidebarChat from '../components/SidebarChat.vue'
import ChatWindow from '../components/ChatWindow.vue'
import ProjectDetail from '../components/ProjectDetail.vue'
import TicketDetail from '../components/TicketDetail.vue'
import AppModal from '../components/AppModal.vue'
import DevInstancePanel from '../components/DevInstancePanel.vue'
import { useAuthStore } from '../stores/auth.js'
import { useChatStore } from '../stores/chat.js'
import { useCommandStore } from '../stores/command.js'
import { useProjectStore } from '../stores/project.js'
import { useTicketStore } from '../stores/ticket.js'
import { useUiStore } from '../stores/ui.js'

export default {
  components: { Topbar, SidebarChat, ChatWindow, ProjectDetail, TicketDetail, AppModal, DevInstancePanel },
  setup() {
    const auth = useAuthStore()
    const chat = useChatStore()
    const cmd = useCommandStore()
    const projectStore = useProjectStore()
    const ticketStore = useTicketStore()
    const ui = useUiStore()
    const { panelCollapsed, panelHeight } = storeToRefs(ui)
    const { selectedProject } = storeToRefs(projectStore)
    const { selectedTicket } = storeToRefs(ticketStore)

    const isTransitioning = ref(false)
    let transitionTimer = null

    function startResize(e) {
      isTransitioning.value = false

      function onMouseMove(e) {
        panelHeight.value = Math.max(60, window.innerHeight - e.clientY)
      }

      function onMouseUp() {
        document.removeEventListener('mousemove', onMouseMove)
        document.removeEventListener('mouseup', onMouseUp)
        document.body.style.cursor = ''
        document.body.style.userSelect = ''
        ui.saveLayoutPrefs()
      }

      document.addEventListener('mousemove', onMouseMove)
      document.addEventListener('mouseup', onMouseUp)
      document.body.style.cursor = 'row-resize'
      document.body.style.userSelect = 'none'
    }

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

    watch(panelCollapsed, () => {
      if (transitionTimer) clearTimeout(transitionTimer)
      isTransitioning.value = true
      transitionTimer = setTimeout(() => {
        isTransitioning.value = false
        transitionTimer = null
      }, 300)
    })

    return { selectedProject, selectedTicket, panelCollapsed, panelHeight, isTransitioning, startResize }
  },
}
</script>

<style scoped>
.bottom-panel {
  position: relative;
  overflow: hidden;
  background: #1a1a2e;
  border-top: 1px solid #374151;
  contain: layout style;
}
.bottom-panel.transitioning {
  transition: height 0.25s ease;
}
.bottom-panel.collapsed {
  height: 0 !important;
  border: none;
}
.panel-resize-handle {
  position: absolute;
  top: 0;
  left: 0;
  right: 0;
  height: 7px;
  cursor: row-resize;
  z-index: 10;
  display: flex;
  align-items: center;
  justify-content: center;
}
.panel-resize-handle:hover {
  background: rgba(117, 170, 219, 0.08);
}
.panel-resize-handle-bar {
  width: 36px;
  height: 3px;
  background: #374151;
  border-radius: 2px;
  pointer-events: none;
  transition: background 0.15s;
}
.panel-resize-handle:hover .panel-resize-handle-bar {
  background: #75AADB;
}
</style>
