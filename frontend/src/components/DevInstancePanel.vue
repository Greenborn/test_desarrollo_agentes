<template>
  <div class="dev-instance-panel h-100 d-flex flex-column">
    <div class="tab-bar d-flex align-items-center px-3 pt-2 pb-0 flex-shrink-0">
      <button
        class="tab-btn"
        :class="{ active: activeTab === 'instancias' }"
        @click="activeTab = 'instancias'"
      >
        Instancias de Desarrollo
      </button>
      <button
        class="tab-btn ms-3"
        :class="{ active: activeTab === 'repositorio' }"
        @click="activeTab = 'repositorio'"
      >
        Repositorio
      </button>
      <button
        class="tab-btn ms-3"
        :class="{ active: activeTab === 'tickets' }"
        @click="activeTab = 'tickets'"
      >
        Tickets
      </button>
      <button
        class="tab-btn ms-3"
        :class="{ active: activeTab === 'proyectos' }"
        @click="activeTab = 'proyectos'"
      >
        Proyectos
      </button>
      <button
        class="tab-btn ms-3"
        :class="{ active: activeTab === 'console_logs' }"
        @click="activeTab = 'console_logs'"
      >
        Console Log Navegador
      </button>
      <button
        class="tab-btn ms-3"
        :class="{ active: activeTab === 'events' }"
        @click="activeTab = 'events'"
      >
        Eventos del Navegador
      </button>
      <button
        class="tab-btn ms-3"
        :class="{ active: activeTab === 'network_logs' }"
        @click="activeTab = 'network_logs'"
      >
        Actividad de Red
      </button>
      <button
        v-if="activeTab === 'instancias' && hasProcesses"
        class="btn btn-sm btn-outline-danger py-0 px-2 ms-auto"
        @click="detener"
        :disabled="deteniendo"
        style="font-size: 0.75rem;"
      >
        {{ deteniendo ? 'Deteniendo…' : '🛑 Detener' }}
      </button>
    </div>

    <template v-if="activeTab === 'instancias'">
      <div v-if="!hasProcesses" class="flex-grow-1 d-flex flex-column align-items-center justify-content-center text-muted small" style="gap: 10px;">
        <span v-if="errorMsg">{{ errorMsg }}</span>
        <template v-else>
          <span>No hay instancia de desarrollo activa.</span>
          <button
            class="btn btn-sm py-1 px-3"
            style="font-size: 0.75rem; background: rgba(117, 170, 219, 0.15); color: #75AADB; border: 1px solid rgba(117, 170, 219, 0.3);"
            :disabled="!activeSessionId || startingInstancia"
            @click="iniciarInstancia"
          >{{ startingInstancia ? 'Iniciando…' : '▶ Iniciar Instancia Desarrollo' }}</button>
          <span v-if="!activeSessionId" class="small" style="color: #6b7280;">Seleccione una sesión de chat para habilitar el botón.</span>
        </template>
      </div>
      <div v-else class="d-flex flex-grow-1" style="min-height: 0;">
        <div class="left-panel d-flex flex-column flex-shrink-0 overflow-y-auto px-2 py-1">
          <button
            v-for="p in state.processes"
            :key="p.name"
            class="process-btn d-flex align-items-center gap-1 w-100 text-start px-2 py-1 mb-1"
            :class="{ selected: selectedProcess === p.name }"
            @click="toggleProcess(p.name)"
          >
            <span class="status-dot" :class="p.status"></span>
            <span class="small fw-semibold" :class="p.status === 'running' ? 'text-light' : 'text-muted'">{{ p.name }}</span>
            <span class="badge ms-auto" :class="p.status === 'running' ? 'bg-success-subtle text-success' : 'bg-secondary-subtle text-secondary'" style="font-size: 0.6rem;">{{ typeLabel(p.type) }}</span>
          </button>

          <div v-if="state.resolution" class="mt-auto pt-1 small text-secondary px-2" style="font-size: 0.65rem;">
            🖥️ {{ state.resolution.id }} — {{ state.resolution.width }}x{{ state.resolution.height }}
          </div>
        </div>

        <div class="right-panel d-flex flex-column flex-grow-1 overflow-hidden border-start border-secondary">
          <div class="log-header d-flex align-items-center px-2 py-1 small text-secondary">
            <span v-if="selectedProcess">[{{ selectedProcess }}]</span>
            <span v-else>[todos los procesos]</span>
            <span class="ms-auto text-muted" style="font-size: 0.6rem;">{{ displayedLines }} líneas</span>
          </div>
          <pre ref="logContainerRef" class="log-output flex-grow-1 mb-0 p-2">{{ displayText }}</pre>
        </div>
      </div>
    </template>

    <template v-if="activeTab === 'repositorio'">
      <RepoView class="flex-grow-1" />
    </template>

    <template v-if="activeTab === 'tickets'">
      <TicketPanel class="flex-grow-1" />
    </template>

    <template v-if="activeTab === 'proyectos'">
      <div class="proyectos-panel d-flex flex-column flex-grow-1" style="min-height: 0;">
        <div class="px-3 py-2 flex-shrink-0">
          <input
            v-model="projectFilter"
            type="text"
            class="form-control form-control-sm"
            placeholder="Buscar proyectos..."
            style="background: #0d1117; border-color: #374151; color: #e0e0e0; font-size: 0.75rem;"
          />
        </div>
        <div class="overflow-y-auto flex-grow-1 px-2 pb-2">
          <div
            v-for="p in filteredProjects"
            :key="p.id"
            class="project-item d-flex align-items-center px-2 py-1 mb-1 rounded"
            :class="{ selected: selectedProject?.id === p.id, pinned: pinnedProjectId === p.id }"
            @click="selectProject(p)"
          >
            <span
              class="pin-btn"
              :class="{ pinned: pinnedProjectId === p.id }"
              @click.stop="projectStore.togglePin(p.id)"
              title="Fijar proyecto"
            >📌</span>
            <span class="ms-1 text-truncate">{{ p.id }} — {{ p.descripcion }}</span>
          </div>
          <div v-if="filteredProjects.length === 0" class="text-muted small text-center py-4">
            No hay proyectos
          </div>
        </div>
      </div>
    </template>

    <template v-if="activeTab === 'console_logs'">
      <ConsoleLogPanel class="flex-grow-1" />
    </template>

    <template v-if="activeTab === 'events'">
      <BrowserEventPanel class="flex-grow-1" />
    </template>

    <template v-if="activeTab === 'network_logs'">
      <NetworkLogPanel class="flex-grow-1" />
    </template>
  </div>
</template>

<script>
import { ref, computed, onMounted, onBeforeUnmount, nextTick, watch } from 'vue'
import { storeToRefs } from 'pinia'
import RepoView from './RepoView.vue'
import TicketPanel from './TicketPanel.vue'
import ConsoleLogPanel from './ConsoleLogPanel.vue'
import NetworkLogPanel from './NetworkLogPanel.vue'
import BrowserEventPanel from './BrowserEventPanel.vue'
import { useProjectStore } from '../stores/project.js'
import { useChatStore } from '../stores/chat.js'
import { useDevInstanceStore } from '../stores/devInstance.js'
import { useCommandRegistry } from '../composables/useCommandRegistry.js'
import { useCommandStore } from '../stores/command.js'

export default {
  components: { RepoView, TicketPanel, ConsoleLogPanel, NetworkLogPanel, BrowserEventPanel },
  setup() {
    const devStore = useDevInstanceStore()
    const activeTab = ref('instancias')
    const selectedProcess = ref(null)
    const logContainerRef = ref(null)

    const projectStore = useProjectStore()
    const chatStore = useChatStore()
    const cmdStore = useCommandStore()
    const { find } = useCommandRegistry()
    const { projects, selectedProject, pinnedProjectId } = storeToRefs(projectStore)
    const projectFilter = ref('')

    const filteredProjects = computed(() => {
      const filter = projectFilter.value.toLowerCase().trim()
      if (!filter) return projects.value
      return projects.value.filter(p => {
        const id = (p.id || '').toLowerCase()
        const desc = (p.descripcion || '').toLowerCase()
        return id.includes(filter) || desc.includes(filter)
      })
    })

    function selectProject(p) {
      projectStore.selectProject(p)
    }

    const activeSessionId = computed(() => chatStore.activeSessionId)

    function typeLabel(type) {
      return type === 'backend' ? 'nodemon' : 'npm run dev'
    }

    const displayText = computed(() => {
      const names = devStore.processNames
      if (names.length === 0) return ''

      if (selectedProcess.value) {
        const lines = devStore.logsMap[selectedProcess.value]
        return lines ? lines.join('\n') : ''
      }

      const combined = []
      for (const name of names) {
        const lines = devStore.logsMap[name]
        if (lines && lines.length) {
          combined.push(`── ${name} ──`)
          combined.push(...lines)
        }
      }
      return combined.join('\n')
    })

    const displayedLines = computed(() => {
      if (!displayText.value) return 0
      return displayText.value.split('\n').length
    })

    function toggleProcess(name) {
      selectedProcess.value = selectedProcess.value === name ? null : name
    }

    async function iniciarInstancia() {
      if (!activeSessionId.value) return
      devStore.starting = true
      try {
        const cmd = find('/despliegue_iniciar_instancia')
        await chatStore.runCommand('/despliegue_iniciar_instancia', async (loadingIdx, sid) => {
          if (cmd) {
            return cmd.execute([], { cmdStore, chatStore, loadingIdx, sessionId: sid })
          }
          const res = await fetch('/api/command/execute', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            credentials: 'include',
            body: JSON.stringify({ command: '/despliegue_iniciar_instancia' }),
          })
          const data = await res.json()
          if (data.success) return data.result
          throw new Error(data.result || 'Error al ejecutar comando')
        })
      } catch (err) {
        console.error('Error al iniciar instancia:', err)
      } finally {
        devStore.starting = false
      }
    }

    watch(displayText, async () => {
      await nextTick()
      if (logContainerRef.value) {
        logContainerRef.value.scrollTop = logContainerRef.value.scrollHeight
      }
    })

    onMounted(() => {
      devStore.startPolling()
    })

    onBeforeUnmount(() => {
      devStore.stopPolling()
    })

    return {
      state: devStore.state,
      activeTab,
      selectedProcess,
      deteniendo: devStore.deteniendo,
      errorMsg: devStore.errorMsg,
      logContainerRef,
      hasProcesses: devStore.hasProcesses,
      activeSessionId,
      startingInstancia: devStore.starting,
      iniciarInstancia,
      typeLabel,
      displayText,
      displayedLines,
      toggleProcess,
      detener: devStore.detener,
      projectStore,
      selectedProject,
      pinnedProjectId,
      projectFilter,
      filteredProjects,
      selectProject,
    }
  },
}
</script>

<style scoped>
.dev-instance-panel {
  background: #1a1a2e;
}
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
.left-panel {
  width: auto;
  min-width: 120px;
  max-width: 200px;
  background: #16213e;
}
.process-btn {
  background: none;
  border: none;
  border-radius: 4px;
  cursor: pointer;
  color: #cbd5e1;
  font-size: 0.75rem;
  transition: background 0.15s;
}
.process-btn:hover {
  background: rgba(117, 170, 219, 0.1);
}
.process-btn.selected {
  background: rgba(117, 170, 219, 0.18);
  color: #75AADB;
}
.status-dot {
  width: 6px;
  height: 6px;
  border-radius: 50%;
  display: inline-block;
  flex-shrink: 0;
}
.status-dot.running {
  background: #22c55e;
  box-shadow: 0 0 3px #22c55e;
}
.status-dot.error {
  background: #ef4444;
  box-shadow: 0 0 3px #ef4444;
}
.status-dot.stopped {
  background: #6b7280;
}
.right-panel {
  background: #0d1117;
}
.log-header {
  background: #161b22;
  border-bottom: 1px solid #30363d;
  font-size: 0.7rem;
}
.log-output {
  font-family: 'Consolas', 'Monaco', 'Courier New', monospace;
  font-size: 0.72rem;
  line-height: 1.5;
  color: #e6edf3;
  background: transparent;
  overflow-y: auto;
  white-space: pre-wrap;
  word-break: break-all;
}
.proyectos-panel {
  background: #16213e;
}
.project-item {
  cursor: pointer;
  color: #cbd5e1;
  font-size: 0.75rem;
  transition: background 0.15s;
}
.project-item:hover {
  background: rgba(117, 170, 219, 0.1);
}
.project-item.selected {
  background: rgba(117, 170, 219, 0.18);
  color: #75AADB;
  border-left: 3px solid #75AADB;
}
.project-item.pinned {
  background: #1a3344 !important;
}
.project-item .pin-btn {
  cursor: pointer;
  opacity: 0.3;
  font-size: 0.7rem;
  transition: opacity 0.15s;
  line-height: 1;
  flex-shrink: 0;
}
.project-item .pin-btn.pinned {
  opacity: 1;
}
.project-item .pin-btn:hover {
  opacity: 1;
}
</style>
