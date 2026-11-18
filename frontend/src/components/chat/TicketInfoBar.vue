<template>
  <div v-if="activeSessionId" class="ticket-info-bar px-3 d-flex align-items-center gap-2 flex-wrap" :class="ticketInfo ? priorityClass(ticketInfo.priority_id) : 'priority-none'">
    <template v-if="ticketInfo">
      <span class="priority-dot" :class="priorityClass(ticketInfo.priority_id)"></span>
      <span class="ticket-id">#{{ ticketInfo.redmine_id }}</span>
      <span class="ticket-sep text-muted">—</span>
      <span class="ticket-subject" :title="ticketInfo.subject">{{ truncatedSubject }}</span>
    </template>
    <button v-else class="btn btn-sm btn-outline-argentina px-2" @click="seleccionarTicket" title="Seleccionar ticket">📌 Seleccionar ticket</button>
    <span v-if="currentBranchDisplay && currentBranchDisplay !== 'Sin repo'" class="branch-name ms-2" :class="{ 'branch-mismatch': branchMismatch }">· rama: {{ currentBranchDisplay }}</span>
    <div class="ms-auto d-flex align-items-center gap-2">
      <button v-if="ticketInfo" class="btn btn-sm btn-outline-argentina px-2" @click="modificarTicket" title="Modificar ticket">✏️</button>
      <button class="btn btn-sm btn-outline-argentina px-2" @click="seleccionarTicket" title="Seleccionar ticket">🔍</button>
      <button class="btn btn-sm btn-outline-argentina px-2" @click="crearTicket" title="Crear ticket">🎫</button>
      <button class="btn btn-sm btn-outline-argentina px-2" @click="crearProyecto" title="Crear proyecto">📁</button>
      <button v-if="!devInstanceRunning" class="btn btn-sm btn-outline-argentina px-2" @click="iniciarInstanciaDev" title="Iniciar instancia desarrollo">▶️</button>
      <button v-else class="btn btn-sm btn-outline-danger px-2" @click="detenerInstanciaDev" title="Detener instancia desarrollo">⏹️</button>
      <button class="btn btn-sm btn-outline-argentina px-2" @click="configurarDespliegue" title="Configurar despliegue (deploy.json)">📋</button>
      <button class="btn btn-sm btn-outline-argentina px-2" @click="generarCommit" title="Generar commit">💾</button>
      <button class="btn btn-sm btn-outline-argentina px-2" @click="iniciarAgentePorDefecto" @contextmenu.prevent="abrirMenuAgente" :title="tituloBotonAgente">🚀</button>
      <button class="btn btn-sm btn-outline-argentina px-2" @click="syncSkills" title="Sincronizar configuración de skills del proyecto">⚙️</button>
      <button class="btn btn-sm btn-outline-argentina px-2" @click="iniciarTerminal" title="Abrir terminal">💻</button>
      <button class="btn btn-sm btn-outline-argentina px-2" @click="abrirNavegador" title="Abrir navegador Playwright">🌐</button>
      <button class="btn btn-sm btn-outline-danger px-2" @click="clearChat" title="Limpiar chat">🗑️</button>
      <div class="zoom-controls d-flex align-items-center gap-1">
        <button class="btn btn-sm btn-outline-secondary px-1 zoom-btn" @click="zoomOut" :disabled="gitStore.chatZoom <= 50" title="Alejar">−</button>
        <span class="zoom-level small" @click="gitStore.chatZoom = 100; gitStore.saveZoom('chat', 100)" style="cursor:pointer; min-width:36px; text-align:center;" title="Restablecer zoom">{{ gitStore.chatZoom }}%</span>
        <button class="btn btn-sm btn-outline-secondary px-1 zoom-btn" @click="zoomIn" :disabled="gitStore.chatZoom >= 200" title="Acercar">+</button>
      </div>
    </div>
    <template v-if="menuAgente.show">
      <div class="ticket-agent-menu-backdrop" @mousedown="cerrarMenuAgente" @contextmenu.prevent></div>
      <div ref="menuAgenteRef" class="ticket-agent-menu" :style="{ top: menuAgente.y + 'px', left: menuAgente.x + 'px' }" @click.stop>
        <div class="ticket-agent-menu-title">Agente por defecto</div>
        <div
          v-for="(etiqueta, clave) in AGENTES"
          :key="clave"
          class="ticket-agent-menu-item"
          @click="seleccionarAgentePorDefecto(clave)"
        >
          <span class="ticket-agent-check">{{ agentePorDefecto === clave ? '✓' : '' }}</span>{{ etiqueta }}
        </div>
      </div>
    </template>
  </div>
</template>

<script>
import { ref, computed, watch, nextTick } from 'vue'
import { adjustContextMenuPosition } from '../../utils/contextMenu.js'
import { storeToRefs } from 'pinia'
import { useChatStore } from '../../stores/chat.js'
import { useGitStore } from '../../stores/git.js'
import { useSettingsStore } from '../../stores/settings.js'
import { useDevInstanceStore } from '../../stores/devInstance.js'
import { useCommandRegistry } from '../../composables/useCommandRegistry.js'

export default {
  setup() {
    const chatStore = useChatStore()
    const gitStore = useGitStore()
    const settingsStore = useSettingsStore()
    const devInstanceStore = useDevInstanceStore()
    const { activeSessionId } = storeToRefs(chatStore)
    const { sessions } = storeToRefs(chatStore)
    const { find } = useCommandRegistry()

    const ticketInfo = ref(null)
    const devInstanceRunning = computed(() => devInstanceStore.hasProcesses)

    // Agentes que lanza el botón 🚀. La elección se guarda en prefs de la sesión (clave `agentePorDefecto`).
    const AGENTES = { opencode: 'OpenCode', claude: 'Claude' }
    // Valor usado solo cuando la sesión todavía no tiene preferencia guardada.
    const AGENTE_INICIAL = 'opencode'

    const agentePorDefecto = computed(() => {
      if (!activeSessionId.value) return AGENTE_INICIAL
      const valor = chatStore.getSessionPrefs(activeSessionId.value).agentePorDefecto
      if (valor === undefined) return AGENTE_INICIAL
      return valor
    })

    const tituloBotonAgente = computed(() =>
      `Iniciar agente ${AGENTES[agentePorDefecto.value]} (clic derecho: elegir agente por defecto)`
    )

    const menuAgente = ref({ show: false, x: 0, y: 0 })
    const menuAgenteRef = ref(null)

    function abrirMenuAgente(e) {
      if (!activeSessionId.value) return
      menuAgente.value = { show: true, x: e.clientX, y: e.clientY }
      nextTick(() => {
        if (!menuAgenteRef.value) return
        const ajustado = adjustContextMenuPosition(menuAgenteRef.value, menuAgente.value.x, menuAgente.value.y)
        menuAgente.value.x = ajustado.x
        menuAgente.value.y = ajustado.y
      })
    }

    function cerrarMenuAgente() {
      menuAgente.value = { ...menuAgente.value, show: false }
    }

    async function seleccionarAgentePorDefecto(clave) {
      cerrarMenuAgente()
      if (!activeSessionId.value) return
      await chatStore.saveSessionPref(activeSessionId.value, 'agentePorDefecto', clave)
    }

    function iniciarAgentePorDefecto() {
      if (agentePorDefecto.value === 'claude') return iniciarClaude()
      return iniciarOpencode()
    }

    async function loadTicketInfo() {
      ticketInfo.value = null
      if (!activeSessionId.value) return
      const session = sessions.value.find(s => Number(s.id) === Number(activeSessionId.value))
      if (!session?.id_ticket_redmine) return
      const ticket = await chatStore.loadTicketInfo(activeSessionId.value)
      if (ticket) ticketInfo.value = ticket
    }

    watch(activeSessionId, () => {
      loadTicketInfo()
    })

    watch(
      () => {
        const s = sessions.value.find(s => Number(s.id) === Number(activeSessionId.value))
        return s?.id_ticket_redmine
      },
      () => { loadTicketInfo() }
    )

    const currentBranchDisplay = computed(() => gitStore.getCurrentBranch(activeSessionId.value))

    const idTicketRedmine = computed(() => {
      if (ticketInfo.value?.redmine_id) return ticketInfo.value.redmine_id
      const session = sessions.value.find(s => Number(s.id) === Number(activeSessionId.value))
      return session?.id_ticket_redmine || null
    })

    const expectedTicketBranch = computed(() => {
      if (!idTicketRedmine.value) return null
      const acronimo = settingsStore.repoAcronimo || 'TKT'
      return acronimo + '-' + idTicketRedmine.value
    })

    const branchMismatch = computed(() => {
      if (!expectedTicketBranch.value || !currentBranchDisplay.value) return false
      return currentBranchDisplay.value !== expectedTicketBranch.value
    })

    const truncatedSubject = computed(() => {
      if (!ticketInfo.value?.subject) return ''
      const s = ticketInfo.value.subject
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

    async function executeCommand(raw) {
      const sid = activeSessionId.value
      if (!sid) return
      const parts = raw.split(/\s+/)
      const cmdName = parts[0].toLowerCase()
      const known = find(cmdName)
      try {
        await chatStore.runCommand(raw, async (loadingIdx, sessionId) => {
          if (known) {
            return known.execute(parts.slice(1), { cmdStore: null, chatStore, loadingIdx, sessionId })
          }
          const res = await fetch('/api/command/execute', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            credentials: 'include',
            body: JSON.stringify({ command: raw }),
          })
          const data = await res.json()
          if (data.success) return data.result
          throw new Error(data.result || 'Error al ejecutar comando')
        })
      } finally {
        gitStore.fetchGitBranch(sid)
      }
    }

    async function generarCommit() {
      if (!activeSessionId.value) return
      await executeCommand('/dev_generar_commit')
    }

    async function iniciarInstanciaDev() {
      if (!activeSessionId.value) return
      await executeCommand('/despliegue_iniciar_instancia')
      await devInstanceStore.fetchStatus()
    }

    async function detenerInstanciaDev() {
      if (!activeSessionId.value) return
      await executeCommand('/despliegue_detener_instancia')
      await devInstanceStore.fetchStatus()
    }

    async function modificarTicket() {
      if (!activeSessionId.value) return
      await executeCommand('/chat_edit_ticket')
    }

    async function seleccionarTicket() {
      if (!activeSessionId.value) return
      await executeCommand('/chat_select_ticket')
    }

    async function crearTicket() {
      if (!activeSessionId.value) return
      await executeCommand('/redmine_crear_ticket')
    }

    async function crearProyecto() {
      if (!activeSessionId.value) return
      await executeCommand('/redmine_crear_proyecto')
    }

    async function iniciarOpencode() {
      if (!activeSessionId.value) return
      await executeCommand('/dev_opencode_iniciar')
    }

    function iniciarClaude() {
      const sid = activeSessionId.value
      if (!sid) return
      const session = sessions.value.find(s => Number(s.id) === Number(sid))
      const cwd = session?.cwd || ''
      if (!cwd) {
        chatStore.pushMessage({
          role: 'opencode_control',
          controlData: {
            controlType: 'cd_selector',
            controlId: 'cd-' + Date.now(),
            currentDir: '/',
          },
          _key: 'ctrl-' + Date.now(),
        }, sid)
        return
      }
      chatStore.openTerminal({ cwd, initCommand: 'claude', label: 'Claude', sessionId: sid })
    }

    async function iniciarTerminal() {
      if (!activeSessionId.value) return
      await executeCommand('/terminal')
    }

    async function syncSkills() {
      if (!activeSessionId.value) return
      await executeCommand('/opencode_sync_skills')
    }

    async function configurarDespliegue() {
      if (!activeSessionId.value) return
      await executeCommand('/despliegue_actualizar_config')
    }

    async function clearChat() {
      if (!activeSessionId.value) return
      await chatStore.limpiarSesion(activeSessionId.value)
    }

    function abrirNavegador() {
      if (!activeSessionId.value) return
      chatStore.pushMessage({
        role: 'opencode_control',
        controlData: {
          controlType: 'navegador_iniciar',
          controlId: 'navegador-' + Date.now(),
          sessionId: activeSessionId.value,
        },
        _key: 'ctrl-' + Date.now(),
      }, activeSessionId.value)
    }

    return {
      gitStore, ticketInfo, activeSessionId, currentBranchDisplay,
      branchMismatch, truncatedSubject, priorityClass, devInstanceRunning,
      zoomIn, zoomOut,
      generarCommit, configurarDespliegue, iniciarInstanciaDev, detenerInstanciaDev,
      modificarTicket, seleccionarTicket, crearTicket, crearProyecto, iniciarOpencode, syncSkills, iniciarTerminal, clearChat, abrirNavegador,
      AGENTES, agentePorDefecto, tituloBotonAgente, menuAgente, menuAgenteRef,
      abrirMenuAgente, cerrarMenuAgente, seleccionarAgentePorDefecto, iniciarAgentePorDefecto,
    }
  },
}
</script>

<style>
.ticket-info-bar {
  background: #0f1a2e;
  border-bottom: 2px solid #374151;
  font-size: 0.8rem;
  color: #9ca3af;
  min-height: 48px;
  height: 100%;
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
.branch-mismatch {
  color: #eab308 !important;
  font-weight: 700 !important;
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
.ticket-agent-menu-backdrop {
  position: fixed;
  top: 0;
  left: 0;
  width: 100%;
  height: 100%;
  z-index: 9998;
}
.ticket-agent-menu {
  position: fixed;
  z-index: 9999;
  background: #1a2744;
  border: 1px solid #374151;
  border-radius: 6px;
  padding: 4px 0;
  min-width: 170px;
  box-shadow: 0 4px 12px rgba(0, 0, 0, 0.3);
}
.ticket-agent-menu-title {
  padding: 4px 14px;
  font-size: 0.7rem;
  color: #6b7280;
  text-transform: uppercase;
  letter-spacing: 0.04em;
}
.ticket-agent-menu-item {
  padding: 6px 14px;
  font-size: 0.75rem;
  color: #e6edf3;
  cursor: pointer;
}
.ticket-agent-menu-item:hover {
  background: rgba(117, 170, 219, 0.15);
  color: #75AADB;
}
.ticket-agent-check {
  display: inline-block;
  width: 16px;
  color: #3fb950;
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
