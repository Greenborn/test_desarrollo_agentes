<template>
  <div v-if="activeSessionId" class="ticket-info-bar px-3 d-flex align-items-center gap-2 flex-wrap" :class="ticketInfo ? priorityClass(ticketInfo.priority_id) : 'priority-none'">
    <template v-if="ticketInfo">
      <span class="priority-dot" :class="priorityClass(ticketInfo.priority_id)"></span>
      <span class="ticket-id">#{{ ticketInfo.redmine_id }}</span>
      <span class="ticket-sep text-muted">—</span>
      <span class="ticket-subject" :title="ticketInfo.subject">{{ truncatedSubject }}</span>
    </template>
    <span v-if="currentBranchDisplay && currentBranchDisplay !== 'Sin repo'" class="branch-name ms-2">· rama: {{ currentBranchDisplay }}</span>
    <div class="ms-auto d-flex align-items-center gap-2">
      <button class="btn btn-sm btn-outline-argentina px-2" @click="$emit('crear-ticket')" title="Crear ticket">🎫</button>
      <button v-if="!devInstanceRunning" class="btn btn-sm btn-outline-argentina px-2" @click="$emit('iniciar-instancia-dev')" title="Iniciar instancia desarrollo">▶️</button>
      <button v-else class="btn btn-sm btn-outline-danger px-2" @click="$emit('detener-instancia-dev')" title="Detener instancia desarrollo">⏹️</button>
      <button class="btn btn-sm btn-outline-argentina px-2" @click="$emit('generar-commit')" title="Generar commit">💾</button>
      <button class="btn btn-sm btn-outline-argentina px-2" @click="$emit('iniciar-opencode')" title="Iniciar OpenCode">🚀</button>
      <button class="btn btn-sm btn-outline-danger px-2" @click="$emit('clear-chat')" title="Limpiar chat">🗑️</button>
      <div class="zoom-controls d-flex align-items-center gap-1">
        <button class="btn btn-sm btn-outline-secondary px-1 zoom-btn" @click="zoomOut" :disabled="gitStore.chatZoom <= 50" title="Alejar">−</button>
        <span class="zoom-level small" @click="gitStore.chatZoom = 100; gitStore.saveZoom('chat', 100)" style="cursor:pointer; min-width:36px; text-align:center;" title="Restablecer zoom">{{ gitStore.chatZoom }}%</span>
        <button class="btn btn-sm btn-outline-secondary px-1 zoom-btn" @click="zoomIn" :disabled="gitStore.chatZoom >= 200" title="Acercar">+</button>
      </div>
    </div>
  </div>
</template>

<script>
import { computed } from 'vue'
import { useGitStore } from '../stores/git.js'

export default {
  props: {
    ticketInfo: { type: Object, default: null },
    activeSessionId: { type: [Number, String], default: null },
    devInstanceRunning: { type: Boolean, default: false },
  },
  emits: ['clear-chat', 'generar-commit', 'iniciar-instancia-dev', 'detener-instancia-dev', 'iniciar-opencode', 'crear-ticket'],
  setup(props) {
    const gitStore = useGitStore()

    const currentBranchDisplay = computed(() => gitStore.getCurrentBranch(props.activeSessionId))

    const truncatedSubject = computed(() => {
      if (!props.ticketInfo?.subject) return ''
      const s = props.ticketInfo.subject
      return s.length > 50 ? s.slice(0, 50) + '…' : s
    })

    function priorityClass(priorityId) {
      if (!priorityId) return 'priority-none'
      if (priorityId <= 1) return 'priority-low'
      if (priorityId === 2) return 'priority-normal'
      if (priorityId === 3) return 'priority-high'
      if (priorityId >= 5) return 'priority-immediate'
      if (priorityId >= 4) return 'priority-urgent'
      return 'priority-none'
    }

    function zoomIn() {
      gitStore.zoomIn('chat')
    }

    function zoomOut() {
      gitStore.zoomOut('chat')
    }

    return { gitStore, currentBranchDisplay, truncatedSubject, priorityClass, zoomIn, zoomOut }
  },
}
</script>

<style>
.ticket-info-bar {
  background: #0f1a2e;
  border-bottom: 1px solid #374151;
  font-size: 0.8rem;
  color: #9ca3af;
  min-height: 32px;
  height: auto;
  flex-shrink: 0;
  transition: background 0.2s, border-color 0.2s;
}
.ticket-info-bar.priority-low {
  background: color-mix(in srgb, var(--priority-low-color, #6b7280) 15%, #0f1a2e);
  border-bottom-color: var(--priority-low-color, #6b7280);
}
.ticket-info-bar.priority-normal {
  background: color-mix(in srgb, var(--priority-normal-color, #3b82f6) 15%, #0f1a2e);
  border-bottom: 2px solid var(--priority-normal-color, #3b82f6);
}
.ticket-info-bar.priority-high {
  background: color-mix(in srgb, var(--priority-high-color, #eab308) 15%, #0f1a2e);
  border-bottom: 2px solid var(--priority-high-color, #eab308);
}
.ticket-info-bar.priority-urgent {
  background: color-mix(in srgb, var(--priority-urgent-color, #ef4444) 15%, #0f1a2e);
  border-bottom: 2px solid var(--priority-urgent-color, #ef4444);
}
.ticket-info-bar.priority-immediate {
  background: color-mix(in srgb, var(--priority-immediate-color, #ef4444) 18%, #0f1a2e);
  border-bottom: 2px solid var(--priority-immediate-color, #ef4444);
  border-bottom-width: 3px;
}
.branch-name {
  color: #3fb950;
  font-size: 0.8rem;
  white-space: nowrap;
}
.ticket-id {
  color: #fbbf24;
  font-weight: 600;
}
.ticket-subject {
  color: #e0e0e0;
  min-width: 0;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}
.ticket-sep {
  color: #4b5563;
}
.priority-dot {
  width: 8px;
  height: 8px;
  border-radius: 50%;
  flex-shrink: 0;
  background: #6b7280;
}
.priority-dot.priority-low {
  background: var(--priority-low-color, #9ca3af);
}
.priority-dot.priority-normal {
  background: var(--priority-normal-color, #3b82f6);
}
.priority-dot.priority-high {
  background: var(--priority-high-color, #eab308);
}
.priority-dot.priority-urgent {
  background: var(--priority-urgent-color, #ef4444);
}
.priority-dot.priority-immediate {
  background: var(--priority-immediate-color, #ef4444);
  box-shadow: 0 0 4px var(--priority-immediate-color, #ef4444);
}
.zoom-controls {
  flex-shrink: 0;
}
.zoom-btn {
  line-height: 1;
  font-size: 0.85rem;
  padding-top: 1px;
  padding-bottom: 1px;
  color: #9ca3af;
  border-color: #4b5563;
}
.zoom-btn:hover {
  color: #e0e0e0;
  border-color: #75AADB;
}
.zoom-btn:disabled {
  opacity: 0.4;
}
.zoom-level {
  color: #9ca3af;
  font-weight: 500;
  user-select: none;
}
.zoom-level:hover {
  color: #e0e0e0;
}
</style>
