<template>
  <div
    class="sidebar-right d-flex flex-column h-100 bg-dark"
    :class="{ collapsed: rightPanelCollapsed, transitioning: rightPanelTransitioning }"
    :style="rightPanelCollapsed ? {} : { width: rightPanelWidth + 'px', minWidth: rightPanelWidth + 'px' }"
  >
    <div class="tab-bar d-flex align-items-center px-3 pt-0 pb-1 flex-shrink-0">
      <button class="tab-btn" :class="{ active: activeTab === 'comentarios' }" @click="activeTab = 'comentarios'">Comentarios</button>
      <button class="tab-btn" :class="{ active: activeTab === 'archivos' }" @click="activeTab = 'archivos'">Archivos</button>
    </div>

    <template v-if="activeTab === 'comentarios'">
      <div v-if="!sessionWithTicket" class="d-flex flex-column align-items-center justify-content-center flex-grow-1 text-secondary small px-3 text-center">
        <span v-if="!activeSession">Seleccione una sesión de chat</span>
        <span v-else>Sin ticket vinculado a esta sesión</span>
      </div>
      <div v-else-if="loading" class="d-flex flex-column align-items-center justify-content-center flex-grow-1 text-secondary small">
        <span>Cargando comentarios…</span>
      </div>
      <div v-else-if="comments.length === 0" class="d-flex flex-column align-items-center justify-content-center flex-grow-1 text-secondary small px-3 text-center">
        <span>No hay comentarios encolados para este ticket</span>
      </div>
      <div v-else class="comments-list flex-grow-1 overflow-y-auto px-2 py-1">
        <div v-for="c in comments" :key="c.id" class="comment-item d-flex flex-column px-2 py-2 mb-1 rounded">
          <div class="d-flex align-items-center gap-1 mb-1">
            <span class="badge" :class="badgeClass(c.estado)">{{ c.estado }}</span>
            <span class="text-muted" style="font-size: 0.65rem;">#{{ c.ticket_redmine_id }}</span>
            <span class="ms-auto text-muted" style="font-size: 0.6rem;">{{ formatDate(c.created_at) }}</span>
          </div>
          <div class="comment-preview text-light small text-truncate">{{ c.comentario }}</div>
        </div>
      </div>
    </template>
    <template v-else-if="activeTab === 'archivos'">
      <FileTreePanel :session-id="activeSessionId" />
    </template>
    <div class="sidebar-right-resize-handle" @mousedown.prevent="onResizeStart">
      <div class="sidebar-right-resize-handle-bar"></div>
    </div>
  </div>
</template>

<script>
import { watch, ref, computed } from 'vue'
import { storeToRefs } from 'pinia'
import { useUiStore } from '../stores/ui.js'
import { useChatStore } from '../stores/chat.js'
import { useRedmineCommentsStore } from '../stores/redmineComments.js'
import FileTreePanel from './FileTreePanel.vue'

export default {
  components: { FileTreePanel },
  setup() {
    const ui = useUiStore()
    const chat = useChatStore()
    const redmineComments = useRedmineCommentsStore()
    const { rightPanelCollapsed, rightPanelWidth } = storeToRefs(ui)
    const { activeSessionId, sessions } = storeToRefs(chat)
    const { comments, loading } = storeToRefs(redmineComments)

    const rightPanelTransitioning = ref(false)
    const activeTab = ref('comentarios')
    let transitionTimer = null

    const activeSession = computed(() => {
      return sessions.value.find(s => s.id === activeSessionId.value) || null
    })

    const sessionWithTicket = computed(() => {
      return activeSession.value?.id_ticket_redmine || null
    })

    function formatDate(dateStr) {
      if (!dateStr) return ''
      const d = new Date(dateStr)
      return d.toLocaleDateString('es-AR', { day: '2-digit', month: '2-digit', year: '2-digit', hour: '2-digit', minute: '2-digit' })
    }

    function badgeClass(estado) {
      return {
        pendiente: 'bg-warning text-dark',
        enviado: 'bg-success',
        error: 'bg-danger',
      }[estado] || 'bg-secondary'
    }

    watch(activeSessionId, (newId) => {
      if (!newId) {
        redmineComments.clearComments()
        return
      }
      const session = sessions.value.find(s => s.id === newId)
      if (session?.id_ticket_redmine) {
        redmineComments.loadComments(session.id_ticket_redmine)
      } else {
        redmineComments.clearComments()
      }
    })

    function onResizeStart(e) {
      rightPanelTransitioning.value = false

      function onMouseMove(e) {
        rightPanelWidth.value = Math.max(window.innerWidth * 0.05, Math.min(600, window.innerWidth - e.clientX))
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
      document.body.style.cursor = 'col-resize'
      document.body.style.userSelect = 'none'
    }

    watch(rightPanelCollapsed, () => {
      if (transitionTimer) clearTimeout(transitionTimer)
      rightPanelTransitioning.value = true
      transitionTimer = setTimeout(() => {
        rightPanelTransitioning.value = false
        transitionTimer = null
      }, 300)
    })

    return {
      rightPanelCollapsed,
      rightPanelWidth,
      rightPanelTransitioning,
      activeTab,
      activeSessionId,
      activeSession,
      sessionWithTicket,
      comments,
      loading,
      formatDate,
      badgeClass,
      onResizeStart,
    }
  },
}
</script>

<style scoped>
.tab-bar {
  border-bottom: 1px solid #374151;
}
.tab-btn {
  background: none;
  border: none;
  color: #6b7280;
  font-size: 0.75rem;
  padding: 4px 10px;
  cursor: pointer;
  border-bottom: 2px solid transparent;
  margin-bottom: -1px;
  transition: color 0.15s, border-color 0.15s;
}
.tab-btn:hover {
  color: #cbd5e1;
}
.tab-btn.active {
  color: #75AADB;
  border-bottom-color: #75AADB;
}
.comments-list {
  background: #16213e;
}
.comment-item {
  background: #1a2744;
  border: 1px solid #374151;
}
.comment-item:hover {
  background: #1e3050;
}
.comment-preview {
  font-size: 0.7rem;
  line-height: 1.3;
  color: #cbd5e1;
}
.sidebar-right {
  position: relative;
  padding: 8px;
  border-left: 1px solid #374151;
  background: #1a1a2e;
}
.sidebar-right.transitioning {
  transition: width 0.25s ease, min-width 0.25s ease, padding 0.25s ease, border 0.25s ease;
}
.sidebar-right.collapsed {
  width: 0 !important;
  min-width: 0 !important;
  padding: 0;
  border: none;
  overflow: hidden;
}
.sidebar-right-resize-handle {
  position: absolute;
  top: 0;
  left: -6px;
  width: 12px;
  height: 100%;
  cursor: col-resize;
  z-index: 10;
  display: flex;
  align-items: center;
  justify-content: center;
}
.sidebar-right-resize-handle:hover {
  background: rgba(117, 170, 219, 0.08);
}
.sidebar-right-resize-handle-bar {
  width: 3px;
  height: 36px;
  background: #374151;
  border-radius: 2px;
  pointer-events: none;
  transition: background 0.15s;
}
.sidebar-right-resize-handle:hover .sidebar-right-resize-handle-bar {
  background: #75AADB;
}
</style>
