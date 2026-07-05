<template>
  <div class="d-flex flex-column h-100 overflow-x-hidden" @click="closeCtxMenu">
    <TicketInfoBar :ticket-info="ticketInfo" :active-session-id="activeSessionId" :dev-instance-running="devInstanceRunning" @clear-chat="clearChat" @generar-commit="generarCommit" @iniciar-instancia-dev="iniciarInstanciaDev" @detener-instancia-dev="detenerInstanciaDev" @iniciar-opencode="iniciarOpencode" @crear-ticket="crearTicket" />
    <div class="d-flex flex-column flex-grow-1 overflow-hidden" style="min-height: 0;" :style="{ display: (ocMaximized && isOcSessionActive) ? 'none' : '' }">
      <div class="flex-grow-1 overflow-y-auto" ref="messagesContainer" style="min-height: 0;" :style="{ fontSize: gitStore.chatZoom + '%' }">
        <div v-if="!activeSessionId" class="text-center text-muted mt-5">
          <h5 class="text-white">Selecciona o crea un nuevo chat</h5>
        </div>
        <div v-else class="messages-list p-3">
          <div v-if="loadingMore" class="text-center text-muted small py-2">
            <span class="spinner-border spinner-border-sm me-1" role="status"></span>
            Cargando mensajes anteriores...
          </div>
          <div v-if="!loadingMore && !hasMoreMessages && messages.length > 50" class="text-center text-muted small py-1">
            — Todos los mensajes cargados —
          </div>
          <ChatMessage v-for="m in messages" :key="m.id || m._key" :msg="m" :raw-msg-keys="rawMsgKeys" @control-confirm="onControlConfirm" @contextmenu="onContextMenu" />
          <XtermTerminal v-if="chat.showTerminal && activeSessionId && chat._terminalSessionId === activeSessionId" :label="chat.terminalLabel" :cwd="chat.terminalCwd" :initCommand="chat.terminalInitCommand" :session-id="activeSessionId" :terminal-id="chat.terminalId" @close="onTerminalClose" @terminal-ready="onTerminalReady" />
        </div>
      </div>
      <DeteccionStateBar v-if="deteccionState.running && activeSessionId && getDeteccionSessionId() === activeSessionId" :deteccion-state="deteccionState" @abort="abortDeteccion" />
    <div class="terminal-debug px-3 py-1 small text-muted font-monospace" style="font-size:11px; background:#0d1117; border-bottom:1px solid #21262d; white-space:pre">
🔍 debug: {{terminalDebug}}
    </div>
    </div>
    <OpenCodeStickyBar v-if="ocStore.chatSessionId && activeSessionId && Number(activeSessionId) === Number(ocStore.chatSessionId)" :active-session-id="activeSessionId" v-model:oc-input="ocInput" :oc-streaming="ocStreaming" :maximized="ocMaximized" :style="ocMaximized && isOcSessionActive ? { flex: '1 1 0' } : {}" @send="sendToOpencodeFromSticky" @finish="finishOpencode" @toggle-terminal="showAgentTerminal = !showAgentTerminal" @toggle-maximize="toggleOcMaximized" />

    <OpenCodeAgentTerminal v-if="showAgentTerminal && ocStore.chatSessionId && activeSessionId && Number(activeSessionId) === Number(ocStore.chatSessionId)" :content="terminalContent" @close="showAgentTerminal = false" @clear="clearAgentTerminal" />

    <DeepSeekChatFab v-show="!(ocMaximized && isOcSessionActive) && activeSessionId && !isOcSessionActive" :active-session-id="activeSessionId" @send="handleFabSend" />
    <ContextMenuChat :ctx-menu="ctxMenu" :raw-msg-keys="rawMsgKeys" :msg-key="msgKey" @toggle-raw="toggleRawView" @copy-plain="copyPlainText" @delete="deleteMessage" @close="closeCtxMenu" />
  </div>
</template>

<script>
import { ref, reactive, computed, watch, nextTick, onMounted, onUnmounted } from 'vue'
import { storeToRefs } from 'pinia'
import { useChatStore } from '../../stores/chat.js'
import { useCommandStore } from '../../stores/command.js'
import { useModalStore } from '../../stores/modal.js'
import { useOpencodeStore } from '../../stores/opencode.js'
import { useGitStore } from '../../stores/git.js'
import { useDevInstanceStore } from '../../stores/devInstance.js'
import { useProjectVariablesStore } from '../../stores/projectVariables.js'
import { useUiStore } from '../../stores/ui.js'
import { deteccionState, abortDeteccion, getDeteccionSessionId } from '../../composables/commands/deteccionFuncionalidades.js'
import { useCommandRegistry } from '../../composables/useCommandRegistry.js'
import { useConsoleLogStream } from '../../composables/useConsoleLogStream.js'
import { useNetworkLogStream } from '../../composables/useNetworkLogStream.js'
import { useChatScroll } from '../../composables/useChatScroll.js'
import { useOpencodeStreaming } from '../../composables/useOpencodeStreaming.js'
import { useControlHandlers } from '../../composables/useControlHandlers.js'
import TicketInfoBar from './TicketInfoBar.vue'
import ChatMessage from './ChatMessage.vue'
import DeepSeekChatFab from './DeepSeekChatFab.vue'
import XtermTerminal from './XtermTerminal.vue'
import OpenCodeAgentTerminal from './OpenCodeAgentTerminal.vue'
import DeteccionStateBar from './DeteccionStateBar.vue'
import OpenCodeStickyBar from './OpenCodeStickyBar.vue'
import ContextMenuChat from './ContextMenuChat.vue'
import HelpContent from '../help/HelpModal.vue'

export default {
  components: { TicketInfoBar, ChatMessage, DeepSeekChatFab, XtermTerminal, OpenCodeAgentTerminal, DeteccionStateBar, OpenCodeStickyBar, ContextMenuChat },
  setup() {
    const chat = useChatStore()
    const cmdStore = useCommandStore()
    const modal = useModalStore()
    const ocStore = useOpencodeStore()
    const gitStore = useGitStore()
    const devInstanceStore = useDevInstanceStore()
    const projectVarStore = useProjectVariablesStore()
    const ui = useUiStore()
    const { find } = useCommandRegistry()
    const { activeSessionId, messages, streaming, currentChunk, currentThinking, sessions, loadingMore, hasMoreMessages } = storeToRefs(chat)

    const { messagesContainer, _isNearBottom, scrollToBottom, checkNearBottom } = useChatScroll()

    const streamingApi = useOpencodeStreaming()
    const {
      ocStreaming, ocChunk, ocThinking, streamSessionId, streamingConsole, terminalContent,
      fetchGitBranch, _getProyectoId, resolveInput, addMessage, isActiveSession,
      opencodeStreamPrompt, opencodeStreamPromptCommit, opencodeStreamPromptTestingNotes,
      opencodeStreamPromptDocUpdate, opencodeStreamDescripcion, opencodeStreamDescripcionFollowup,
    } = streamingApi

    const ticketInfo = ref(null)

    const sessionCwd = computed(() => {
      const s = sessions.value.find(s => Number(s.id) === Number(activeSessionId.value))
      return s?.cwd || '~'
    })

    const terminalDebug = computed(() => {
      const ts = chat._terminalSessions || {}
      const keys = Object.keys(ts)
      const items = keys.map(k => k + ':(' + (ts[k]?.terminalId?.slice(0,8) || 'noId') + ')')
      return `sess=${activeSessionId.value} _tsId=${chat._terminalSessionId} tId=${chat.terminalId?.slice(0,8)||'-'} show=${chat.showTerminal} [${items.join(', ')||'none'}]`
    })

    async function loadTicketInfo() {
      ticketInfo.value = null
      if (!activeSessionId.value) return
      const session = sessions.value.find(s => Number(s.id) === Number(activeSessionId.value))
      if (!session?.id_ticket_redmine) return
      try {
        const res = await fetch(`/api/tickets/session/${activeSessionId.value}`, { credentials: 'include' })
        const data = await res.json()
        if (data.ticket) {
          ticketInfo.value = data.ticket
          chat.setSessionTicket(activeSessionId.value, data.ticket)
        }
      } catch (err) {
        console.error('Error al cargar info del ticket:', err)
      }
    }

    const { onControlConfirm } = useControlHandlers({
      opencodeStreamPrompt: streamingApi.opencodeStreamPrompt,
      opencodeStreamPromptCommit: streamingApi.opencodeStreamPromptCommit,
      opencodeStreamPromptTestingNotes: streamingApi.opencodeStreamPromptTestingNotes,
      opencodeStreamPromptDocUpdate: streamingApi.opencodeStreamPromptDocUpdate,
      opencodeStreamDescripcion: streamingApi.opencodeStreamDescripcion,
      opencodeStreamDescripcionFollowup: streamingApi.opencodeStreamDescripcionFollowup,
      fetchGitBranch: streamingApi.fetchGitBranch,
      _getProyectoId: streamingApi._getProyectoId,
      resolveInput: streamingApi.resolveInput,
      isActiveSession: streamingApi.isActiveSession,
      addMessage: streamingApi.addMessage,
      ocStreaming: streamingApi.ocStreaming,
      ocChunk: streamingApi.ocChunk,
      ocThinking: streamingApi.ocThinking,
      streamSessionId: streamingApi.streamSessionId,
      ticketInfo, loadTicketInfo,
    })

    const input = ref('')
    const ocInput = ref('')
    const showAgentTerminal = ref(false)
    function clearAgentTerminal() {
      terminalContent.value = ''
    }
    const ctxMenu = reactive({ show: false, x: 0, y: 0, msg: null })
    const rawMsgKeys = reactive(new Set())

    const shouldStreamConsole = computed(() => {
      return !!(
        chat.activeSessionId &&
        (streamingConsole.value || devInstanceStore.browserSessions.length > 0)
      )
    })

    const devInstanceRunning = computed(() => devInstanceStore.hasProcesses)

    function refreshVariablesOnConsoleLog() {
      const sid = chat.activeSessionId
      if (!sid) return
      const session = chat.sessions.find(s => s.id === sid)
      if (session?.proyecto_id) {
        projectVarStore.loadVariables(session.proyecto_id)
      }
    }

    useConsoleLogStream(() => chat.activeSessionId, shouldStreamConsole, refreshVariablesOnConsoleLog)
    useNetworkLogStream(() => chat.activeSessionId, shouldStreamConsole, refreshVariablesOnConsoleLog)

    let variablesPollTimer = null
    watch(shouldStreamConsole, (enabled) => {
      if (variablesPollTimer) {
        clearInterval(variablesPollTimer)
        variablesPollTimer = null
      }
      if (enabled) {
        variablesPollTimer = setInterval(refreshVariablesOnConsoleLog, 2000)
      }
    })

    function msgKey(msg) {
      return msg.id || msg._key
    }

    async function send() {
      let raw = input.value.trim()
      if (!raw || !chat.activeSessionId) return
      input.value = ''
      raw = await resolveInput(raw)
      if (raw.startsWith('/')) {
        executeCommand(raw)
      } else if (ocStore.chatSessionId && Number(ocStore.chatSessionId) === Number(chat.activeSessionId)) {
        if (ocStreaming.value) {
          ocStore.messageQueue.push(raw)
          chat.pushMessage({
            role: 'opencode_info',
            content: JSON.stringify({ type: 'queued', message: `⏳ Mensaje encolado: "${raw.slice(0, 80)}${raw.length > 80 ? '...' : ''}"` }),
            _key: 'queue-' + Date.now(),
          })
        } else {
          sendToOpencode(raw)
        }
      } else {
        chat.sendMessage(chat.activeSessionId, raw)
      }
    }

    async function sendToOpencode(prompt, overrideSessionId) {
      if (!ocStore.selectedProvider) {
        const sid = overrideSessionId || chat.activeSessionId
        chat.pushMessage({
          role: 'opencode_info',
          content: JSON.stringify({ type: 'info', message: 'No hay sesión OpenCode configurada. Ejecutá /dev_opencode_iniciar primero.' }),
          _key: 'info-' + Date.now(),
        }, sid)
        return
      }
      const targetSessionId = overrideSessionId || chat.activeSessionId || ocStore.chatSessionId
      await opencodeStreamPrompt(
        targetSessionId, prompt,
        ocStore.selectedProvider, ocStore.selectedModel,
        ocStore.selectedThinking, ocStore.selectedMode, ocStore.selectedTemperature,
      )
    }

    async function abortOpencode() {
      try {
        await fetch('/api/opencode/abort', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          credentials: 'include',
          body: JSON.stringify({ ocSessionId: ocStore.ocSessionId, sessionId: chat.activeSessionId }),
        })
      } catch (err) {
        console.error('Error al abortar opencode:', err)
      }
      if (chat.activeSessionId) {
        chat.setOcStreaming(chat.activeSessionId, false)
        chat.clearOcStreamCache(chat.activeSessionId)
        chat.setSessionStatus(chat.activeSessionId, 'idle')
      }
      ocStreaming.value = chat.getIsOcStreaming(chat.activeSessionId)
      chat.pushMessage({
        role: 'opencode_info',
        content: JSON.stringify({ type: 'info', message: '⏹ Tarea detenida por el usuario.' }),
        _key: 'abort-' + Date.now(),
      })
      ocStore.messageQueue = []
    }

    async function sendToOpencodeFromSticky() {
      const raw = ocInput.value.trim()
      const targetSessionId = ocStore.chatSessionId || chat.activeSessionId
      if (!raw || !targetSessionId) return
      ocInput.value = ''
      const resolved = await resolveInput(raw)
      if (resolved.startsWith('/')) {
        executeCommand(resolved)
      } else if (ocStreaming.value) {
        ocStore.messageQueue.push(resolved)
        chat.pushMessage({
          role: 'opencode_info',
          content: JSON.stringify({ type: 'queued', message: `⏳ Mensaje encolado: "${resolved.slice(0, 80)}${resolved.length > 80 ? '...' : ''}"` }),
          _key: 'queue-' + Date.now(),
        }, targetSessionId)
      } else {
        chat.pushMessage({
          role: 'opencode_confirmed',
          content: resolved,
          _key: 'confirmed-' + Date.now(),
        }, targetSessionId)
        chat._saveMessageToDb(targetSessionId, { role: 'opencode_confirmed', content: resolved })
        sendToOpencode(resolved, targetSessionId)
      }
    }

    async function finishOpencode() {
      try {
        await fetch('/api/opencode/finish', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          credentials: 'include',
          body: JSON.stringify({ ocSessionId: ocStore.ocSessionId, sessionId: chat.activeSessionId }),
        })
      } catch (err) {
        console.error('Error al finalizar OpenCode:', err.message)
      }
      ocStore.finish()
    }

    function onContextMenu(e, msg) {
      ctxMenu.show = true
      ctxMenu.x = e.clientX
      ctxMenu.y = e.clientY
      ctxMenu.msg = msg
    }

    function closeCtxMenu() {
      ctxMenu.show = false
    }

    function toggleRawView(msg) {
      const key = msgKey(msg)
      if (rawMsgKeys.has(key)) {
        rawMsgKeys.delete(key)
      } else {
        rawMsgKeys.add(key)
      }
    }

    async function copyPlainText(msg) {
      const text = msg.content || ''
      if (!text) return
      try {
        await navigator.clipboard.writeText(text)
      } catch (err) {
        console.error('Error al copiar al portapapeles:', err.message)
      }
      closeCtxMenu()
    }

    async function deleteMessage(msg) {
      try {
        await chat.deleteMessage(chat.activeSessionId, msg)
      } catch (err) {
        console.error('Error al eliminar mensaje:', err)
      }
      closeCtxMenu()
    }

    async function generarCommit() {
      if (!chat.activeSessionId) return
      await executeCommand('/dev_opencode_generar_commit')
    }

    async function iniciarInstanciaDev() {
      if (!chat.activeSessionId) return
      await executeCommand('/despliegue_iniciar_instancia')
      await devInstanceStore.fetchStatus()
    }

    async function detenerInstanciaDev() {
      if (!chat.activeSessionId) return
      await executeCommand('/despliegue_detener_instancia')
      await devInstanceStore.fetchStatus()
    }

    async function crearTicket() {
      if (!chat.activeSessionId) return
      await executeCommand('/redmine_crear_ticket')
    }

    async function clearChat() {
      const confirmed = confirm('¿Eliminar todos los mensajes de este chat? Esta acción no se puede deshacer.')
      if (!confirmed) return
      await chat.clearMessages(chat.activeSessionId)
    }

    async function iniciarOpencode() {
      if (!chat.activeSessionId) return
      await executeCommand('/dev_opencode_iniciar')
    }

    async function handleFabSend(text) {
      if (!chat.activeSessionId) return
      const resolved = await resolveInput(text)
      if (resolved.startsWith('/')) {
        executeCommand(resolved)
      } else {
        chat.sendMessage(chat.activeSessionId, resolved)
      }
    }

    function onTerminalClose() {
      chat.closeTerminal()
    }

    function onTerminalReady({ terminalId }) {
      if (terminalId && activeSessionId.value) {
        chat.openTerminal({ sessionId: activeSessionId.value, terminalId })
      }
    }

    async function executeCommand(raw) {
      const parts = raw.split(/\s+/)
      const cmdName = parts[0].toLowerCase()
      if (cmdName === '/help') {
        modal.open(HelpContent, {})
        return
      }
      const known = find(cmdName)
      try {
        await chat.runCommand(raw, async (loadingIdx, sid) => {
          if (known) {
            return known.execute(parts.slice(1), { cmdStore, chatStore: chat, loadingIdx, sessionId: sid })
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
        await fetchGitBranch()
        await devInstanceStore.fetchStatus()
      }
    }

    function onScrollLoadMore() {
      const el = messagesContainer.value
      if (!el) return
      _isNearBottom.value = checkNearBottom()
      if (el.scrollTop === 0 && !loadingMore.value && hasMoreMessages.value && activeSessionId.value) {
        const oldScrollHeight = el.scrollHeight
        chat.loadMoreMessages(activeSessionId.value)
        nextTick(() => {
          if (messagesContainer.value) {
            messagesContainer.value.scrollTop = messagesContainer.value.scrollHeight - oldScrollHeight
          }
        })
      }
    }

    let resizeObserver = null

    watch(messages, () => scrollToBottom(false), { deep: true })
    watch([currentChunk, ocChunk], () => scrollToBottom(false))

    watch(activeSessionId, (newId, oldId) => {
      if (oldId) {
        ocStore.saveCurrentToMap(oldId, { ocInput: ocInput.value, showTerminal: showAgentTerminal.value, terminalContent: terminalContent.value })
        ocStore.setSessionShowTerminal(oldId, showAgentTerminal.value)
        ocInput.value = ''
      }
      if (newId) {
        ocStore.activateSession(newId)
        ocStreaming.value = chat.getIsOcStreaming(newId)
        streamingConsole.value = false
        streamingApi._syncStreamData(newId)
        ocInput.value = ocStore.getSessionOcInput(newId)
        showAgentTerminal.value = ocStore.getSessionShowTerminal(newId)
        const savedTerminal = ocStore.getSessionExtra(newId, 'terminalContent')
        if (savedTerminal && !terminalContent.value) {
          terminalContent.value = savedTerminal
        }
        if (chat._hasTerminal(newId)) {
          chat.openTerminal({ sessionId: newId })
        }
      }
      loadTicketInfo()
      fetchGitBranch()
      scrollToBottom(true)
    })

    watch(() => cmdStore.currentDir, () => { fetchGitBranch() })

    watch(
      () => {
        const s = sessions.value.find(s => Number(s.id) === Number(activeSessionId.value))
        return s?.id_ticket_redmine
      },
      () => { loadTicketInfo() }
    )

    onMounted(async () => {
      if (messagesContainer.value) {
        resizeObserver = new ResizeObserver(() => {
          if (messagesContainer.value && _isNearBottom.value) {
            messagesContainer.value.scrollTop = messagesContainer.value.scrollHeight
          }
        })
        resizeObserver.observe(messagesContainer.value)
        messagesContainer.value.addEventListener('scroll', onScrollLoadMore)
      }
      loadTicketInfo()
      gitStore.loadZoom('chat')
      fetchGitBranch()
      await devInstanceStore.fetchStatus()
    })

    onUnmounted(() => {
      if (resizeObserver) resizeObserver.disconnect()
      if (messagesContainer.value) {
        messagesContainer.value.removeEventListener('scroll', onScrollLoadMore)
      }
    })

    const ocMaximized = computed(() => ui.ocMaximized)

    const isOcSessionActive = computed(() => {
      return ocStore.chatSessionId && activeSessionId.value && Number(activeSessionId.value) === Number(ocStore.chatSessionId)
    })

    function toggleOcMaximized() {
      ui.toggleOcMaximized()
    }

    return {
      chat, activeSessionId, messages, streaming, currentChunk, currentThinking,
      sessions, loadingMore, hasMoreMessages, input, gitStore, ocStore,
      ocInput, ocStreaming, terminalContent, sessionCwd, terminalDebug, onTerminalClose, onTerminalReady,
      ticketInfo, devInstanceRunning, ocMaximized, isOcSessionActive,
      deteccionState, abortDeteccion,
      ctxMenu, rawMsgKeys, msgKey,
      messagesContainer,
      send, handleFabSend, sendToOpencodeFromSticky, finishOpencode,
      generarCommit, iniciarInstanciaDev, detenerInstanciaDev,
      clearChat, crearTicket, iniciarOpencode,
      onControlConfirm, toggleOcMaximized,
      onContextMenu, closeCtxMenu, toggleRawView, copyPlainText, deleteMessage,
      showAgentTerminal, clearAgentTerminal,
    }
  },
}
</script>

<style>
html, body {
  overflow-x: hidden;
}
.blink {
  animation: blink 1s step-end infinite;
}
@keyframes blink {
  50% { opacity: 0; }
}
.messages-list {
  padding: 1rem;
}
</style>
