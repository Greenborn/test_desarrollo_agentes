<template>
  <div class="dev-instance-panel h-100 d-flex flex-column">
    <div class="tab-bar d-flex align-items-center px-3 pt-2 pb-0 flex-shrink-0">
      <button
        class="tab-btn"
        :class="{ active: tab === 'instancias' }"
        @click="selectDevTab('instancias')"
      >
        Instancias de Desarrollo
      </button>
      <button
        class="tab-btn ms-3"
        :class="{ active: tab === 'repositorio' }"
        @click="selectDevTab('repositorio')"
      >
        Repositorio
      </button>
      <button
        class="tab-btn ms-3"
        :class="{ active: tab === 'tickets' }"
        @click="selectDevTab('tickets')"
      >
        Tickets
      </button>
      <button
        class="tab-btn ms-3"
        :class="{ active: tab === 'proyectos' }"
        @click="selectDevTab('proyectos')"
      >
        Proyectos
      </button>
      <button
        class="tab-btn ms-3"
        :class="{ active: tab === 'console_logs' }"
        @click="selectDevTab('console_logs')"
      >
        Console Log Navegador
      </button>
      <button
        class="tab-btn ms-3"
        :class="{ active: tab === 'events' }"
        @click="selectDevTab('events')"
      >
        Eventos del Navegador
      </button>
      <button
        class="tab-btn ms-3"
        :class="{ active: tab === 'network_logs' }"
        @click="selectDevTab('network_logs')"
      >
        Actividad de Red
      </button>
      <div v-if="tab === 'instancias'" class="ms-auto d-flex align-items-center gap-1">
        <button
          class="btn btn-sm py-0 px-1"
          style="font-size: 0.7rem; color: #6b7280; background: none; border: none; line-height: 1;"
          @click="refrescar"
          title="Refrescar estado"
        >↻</button>
        <button
          v-if="hasProcesses"
          class="btn btn-sm btn-outline-danger py-0 px-2"
          @click="detener"
          :disabled="deteniendo"
          style="font-size: 0.75rem;"
        >
          {{ deteniendo ? 'Deteniendo…' : '🛑 Detener' }}
        </button>
      </div>
    </div>

    <template v-if="tab === 'instancias'">
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
            v-for="p in devProcesses"
            :key="p.name"
            class="process-btn d-flex align-items-center gap-1 w-100 text-start px-2 py-1 mb-1"
            :class="{ selected: selectedProcess === p.name }"
            @click="toggleProcess(p.name)"
          >
            <span class="status-dot" :class="p.status"></span>
            <span class="small fw-semibold" :class="p.status === 'running' ? 'text-light' : 'text-muted'">{{ p.name }}</span>
            <span class="badge ms-auto" :class="p.status === 'running' ? 'bg-success-subtle text-success' : 'bg-secondary-subtle text-secondary'" style="font-size: 0.6rem;">{{ typeLabel(p.type) }}</span>
          </button>

          <div v-if="devResolution" class="mt-auto pt-1 small text-secondary px-2" style="font-size: 0.65rem;">
            🖥️ {{ devResolution.id }} — {{ devResolution.width }}x{{ devResolution.height }}
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

      <div class="port-killer d-flex align-items-center px-2 py-1 border-top border-secondary flex-shrink-0" style="gap: 6px;">
        <input
          v-model="portsInput"
          type="text"
          class="form-control form-control-sm"
          placeholder="Puertos a cerrar (ej: 5173, 3000, 3001)"
          style="background: #0d1117; border-color: #374151; color: #e0e0e0; font-size: 0.7rem; max-width: 280px;"
          @keyup.enter="cerrarPuertosAction"
        />
        <button
          class="btn btn-sm py-0 px-2"
          style="font-size: 0.7rem; border-color: #dc3545; color: #dc3545;"
          :disabled="!portsInput.trim() || cerrandoPuertosRef"
          @click="cerrarPuertosAction"
        >
          {{ cerrandoPuertosRef ? 'Cerrando…' : '✕ Cerrar Puertos' }}
        </button>
      </div>
    </template>

    <template v-if="tab === 'repositorio'">
      <RepoView class="flex-grow-1" :key="activeSessionId" />
    </template>

    <template v-if="tab === 'tickets'">
      <TicketPanel class="flex-grow-1" />
    </template>

    <template v-if="tab === 'proyectos'">
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

    <template v-if="tab === 'console_logs'">
      <ConsoleLogPanel class="flex-grow-1" />
    </template>

    <template v-if="tab === 'events'">
      <BrowserEventPanel class="flex-grow-1" />
    </template>

    <template v-if="tab === 'network_logs'">
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
import { useProjectVariablesStore } from '../stores/projectVariables.js'
import { useUiStore } from '../stores/ui.js'

export default {
  components: { RepoView, TicketPanel, ConsoleLogPanel, NetworkLogPanel, BrowserEventPanel },
  setup() {
    const devStore = useDevInstanceStore()
    const {
      processes: devProcesses,
      resolution: devResolution,
      logsMap: devLogsMap,
      hasProcesses,
      starting: startingInstancia,
      deteniendo,
      errorMsg,
    } = storeToRefs(devStore)
    const devFetchStatus = devStore.fetchStatus
    const devDetener = devStore.detener
    const devCerrarPuertos = devStore.cerrarPuertos
    const ui = useUiStore()
    const { devPanelTab } = storeToRefs(ui)
    const tab = ref('instancias')
    const stopTabSync = watch(devPanelTab, (v) => { tab.value = v; stopTabSync() })
    const selectedProcess = ref(null)
    const logContainerRef = ref(null)
    const portsInput = ref('')
    const cerrandoPuertosRef = ref(false)

    const projectStore = useProjectStore()
    const chatStore = useChatStore()
    const cmdStore = useCommandStore()
    const projectVarsStore = useProjectVariablesStore()
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
      const names = devStore.processNames // computed, not a ref, access through store
      if (names.length === 0) return ''

      if (selectedProcess.value) {
        const lines = devLogsMap.value[selectedProcess.value]
        return lines ? lines.join('\n') : ''
      }

      const combined = []
      for (const name of names) {
        const lines = devLogsMap.value[name]
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

    function selectDevTab(val) {
      tab.value = val
      devPanelTab.value = val
      ui.saveLayoutPrefs()
    }

    function toggleProcess(name) {
      selectedProcess.value = selectedProcess.value === name ? null : name
    }

    async function iniciarInstancia() {
      if (!activeSessionId.value) return
      startingInstancia.value = true
      console.log('[DevInstancePanel] Iniciando instancia, sesión:', activeSessionId.value)
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
        console.log('[DevInstancePanel] Comando completado, consultando estado...')
        await devFetchStatus()
        console.log('[DevInstancePanel] Estado actual, procesos:', devProcesses.value)
      } catch (err) {
        console.error('[DevInstancePanel] Error al iniciar instancia:', err)
      } finally {
        startingInstancia.value = false
      }
    }

    async function refrescar() {
      await devFetchStatus()
    }

    async function cerrarPuertosAction() {
      if (!portsInput.value.trim()) return
      const ports = portsInput.value
        .split(',')
        .map(p => p.trim())
        .filter(p => p.length > 0 && !isNaN(parseInt(p, 10)))
        .map(p => parseInt(p, 10))
      if (ports.length === 0) return
      cerrandoPuertosRef.value = true
      try {
        await devCerrarPuertos(ports)
        const portsStr = ports.join(', ')
        if (pinnedProjectId.value) {
          try {
            await projectVarsStore.saveVariable(pinnedProjectId.value, 'ports_to_close', portsStr)
          } catch (err) {
            console.error('[DevInstancePanel] Error al guardar puertos en variable del proyecto:', err)
          }
        }
        localStorage.setItem('dev_ports_to_close_default', portsStr)
        portsInput.value = portsStr
      } catch (err) {
        console.error('[DevInstancePanel] Error al cerrar puertos:', err)
      } finally {
        cerrandoPuertosRef.value = false
      }
    }

    watch(pinnedProjectId, async (newId) => {
      if (newId) {
        await projectVarsStore.loadVariables(newId)
        const vars = projectVarsStore.variablesByProject[newId] || []
        const portsVar = vars.find(v => v.key === 'ports_to_close')
        portsInput.value = portsVar ? portsVar.value : (localStorage.getItem('dev_ports_to_close_default') || '')
      } else {
        portsInput.value = localStorage.getItem('dev_ports_to_close_default') || ''
      }
    }, { immediate: true })

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
      devProcesses,
      devResolution,
      tab,
      selectDevTab,
      selectedProcess,
      deteniendo,
      errorMsg,
      logContainerRef,
      hasProcesses,
      activeSessionId,
      startingInstancia,
      iniciarInstancia,
      refrescar,
      cerrarPuertosAction,
      portsInput,
      cerrandoPuertosRef,
      typeLabel,
      displayText,
      displayedLines,
      toggleProcess,
      detener: devDetener,
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
