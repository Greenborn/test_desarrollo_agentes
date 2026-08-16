<template>
  <div class="d-flex flex-column h-100 overflow-x-hidden" @click="closeCtxMenu">
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
          <div :style="{ height: topPad + 'px' }"></div>
          <ChatMessage v-for="m in visibleMessages" :key="m.id ?? m._key" :ref="(el) => setMsgEl(m, el)" :msg="m" :raw-msg-keys="rawMsgKeys" @control-confirm="onControlConfirm" @contextmenu="onContextMenu" />
          <div :style="{ height: bottomPad + 'px' }"></div>
          <template v-for="ts in terminalSessions" :key="ts.sid + '-' + ts._key">
            <XtermTerminal v-show="ts.isActive" :label="ts.label" :cwd="ts.cwd" :init-command="ts.initCommand" :session-id="ts.sid" :terminal-id="ts.terminalId" @close="onTerminalClose" @terminal-ready="onTerminalReady" @exit="onTerminalExit" />
          </template>
        </div>
      </div>
      <DeteccionStateBar v-if="deteccionState.running && activeSessionId && getDeteccionSessionId() === activeSessionId" :deteccion-state="deteccionState" @abort="abortDeteccion" />
    </div>
    <template v-if="activeSessionId">
      <OpenCodeAgentTerminal
        v-for="agent in ocAgents"
        :key="agent.id"
        :content="getAgentTerminalContent(agent.id)"
        @close="closeAgent(agent)"
        @clear="clearAgent(agent.id)"
      />
    </template>

    <DeepSeekChatFab v-show="!(ocMaximized && isOcSessionActive) && activeSessionId && !isOcSessionActive" :active-session-id="activeSessionId" @send="handleFabSend" />
    <ContextMenuChat :ctx-menu="ctxMenu" :raw-msg-keys="rawMsgKeys" :msg-key="msgKey" @toggle-raw="toggleRawView" @copy-plain="copyPlainText" @delete="deleteMessage" @close="closeCtxMenu" @adjust-position="({ x, y }) => { ctxMenu.x = x; ctxMenu.y = y }" />
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
import { useChatVirtualScroll } from '../../composables/useChatVirtualScroll.js'
import { useOpencodeStreaming } from '../../composables/useOpencodeStreaming.js'
import { useControlHandlers } from '../../composables/useControlHandlers.js'
import ChatMessage from './ChatMessage.vue'
import DeepSeekChatFab from './DeepSeekChatFab.vue'
import XtermTerminal from './XtermTerminal.vue'
import OpenCodeAgentTerminal from './OpenCodeAgentTerminal.vue'
import DeteccionStateBar from './DeteccionStateBar.vue'
import ContextMenuChat from './ContextMenuChat.vue'
import HelpContent from '../help/HelpModal.vue'

export default {
  components: { ChatMessage, DeepSeekChatFab, XtermTerminal, OpenCodeAgentTerminal, DeteccionStateBar, ContextMenuChat },
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

    const { messagesContainer, _isNearBottom, scrollToBottom } = useChatScroll()
    const vs = useChatVirtualScroll(messages)

    const streamingApi = useOpencodeStreaming()
    const {
      ocStreaming, ocChunk, ocThinking, streamSessionId, streamingConsole, terminalContent,
      fetchGitBranch, _getProyectoId, resolveInput, addMessage, isActiveSession,
      opencodeStreamPrompt, opencodeStreamPromptCommit, opencodeStreamPromptTestingNotes,
      opencodeStreamDescripcion, opencodeStreamDescripcionFollowup,
      getAgentTerminalContent, clearAgentTerminalContent,
    } = streamingApi

    const ticketInfo = ref(null)

    const sessionCwd = computed(() => {
      const s = sessions.value.find(s => Number(s.id) === Number(activeSessionId.value))
      return s?.cwd || '~'
    })

    const terminalSessions = computed(() => {
      const ts = chat._terminalSessions || {}
      const result = []
      for (const [sid, terminals] of Object.entries(ts)) {
        if (!Array.isArray(terminals)) continue
        terminals.forEach((t) => {
          result.push({
            sid,
            _key: t._key,
            terminalId: t.terminalId,
            label: t.label,
            cwd: t.cwd,
            initCommand: t.initCommand,
            isActive: Number(sid) === Number(activeSessionId.value),
          })
        })
      }
      return result
    })

    async function loadTicketInfo() {
      ticketInfo.value = null
      if (!activeSessionId.value) return
      const session = sessions.value.find(s => Number(s.id) === Number(activeSessionId.value))
      if (!session?.id_ticket_redmine) return
      const ticket = await chat.loadTicketInfo(activeSessionId.value)
      if (ticket) ticketInfo.value = ticket
    }

    const { onControlConfirm } = useControlHandlers({
      opencodeStreamPrompt: streamingApi.opencodeStreamPrompt,
      opencodeStreamPromptCommit: streamingApi.opencodeStreamPromptCommit,
      opencodeStreamPromptTestingNotes: streamingApi.opencodeStreamPromptTestingNotes,
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
    const showAgentTerminal = ref(false)
    function clearAgent(agentId) {
      clearAgentTerminalContent(agentId)
    }
    function closeAgent(agent) {
      if (agent.ocSessionId && activeSessionId.value) {
        fetch('/api/opencode/close-agent', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          credentials: 'include',
          body: JSON.stringify({ ocSessionId: agent.ocSessionId, sessionId: activeSessionId.value }),
        }).catch(err => console.error('Error al cerrar agente:', err.message))
      }
      ocStore.removeAgent(activeSessionId.value, agent.id)
    }
    const ocAgents = computed(() => {
      const sid = activeSessionId.value
      return sid ? ocStore.getAgents(sid) : []
    })
    const ctxMenu = reactive({ show: false, x: 0, y: 0, msg: null })
    const rawMsgKeys = reactive(new Set())

    const shouldStreamConsole = computed(() => {
      return !!(
        chat.activeSessionId &&
        (streamingConsole.value || devInstanceStore.browserSessions.length > 0)
      )
    })

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
      return msg.id ?? msg._key
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
          content: JSON.stringify({ type: 'info', message: 'No hay sesión OpenCode configurada. Seleccioná un proveedor en la configuración primero.' }),
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

    function onContextMenu(e, msg) {
      ctxMenu.show = true
      ctxMenu.x = e.clientX
      ctxMenu.y = e.clientY
      ctxMenu.msg = msg
      ctxMenu.target = e.target
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

    async function handleFabSend(text) {
      if (!chat.activeSessionId) return
      const resolved = await resolveInput(text)
      if (resolved.startsWith('/')) {
        executeCommand(resolved)
      } else {
        chat.sendMessage(chat.activeSessionId, resolved)
      }
    }

    function onTerminalClose(terminalId) {
      chat.closeTerminal(terminalId)
    }

    function onTerminalReady({ terminalId, sessionId }) {
      const sid = sessionId || activeSessionId.value
      if (terminalId && sid) {
        chat.openTerminal({ sessionId: sid, terminalId })
      }
    }

    async function onTerminalExit({ code, output, terminalId }) {
      const sid = activeSessionId.value
      if (!sid || !terminalId) return
      chat.touchActivity(sid)
      chat.triggerAlert(sid)

      const pending = chat.consumeCmdPendingSave(sid)
      if (!pending) return

      const finalContent = output ?? '(sin salida)'
      if (!pending.ocultarEjecucion) {
        try {
          await fetch('/api/chat/sessions/' + sid + '/save-messages', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            credentials: 'include',
            body: JSON.stringify({
              messages: [
                { role: 'command', content: '$ ' + pending.commandLabel },
                { role: 'result', content: finalContent },
              ],
            }),
          })
        } catch (err) {
          console.error('Error guardando resultado de comando en terminal:', err)
        }
      }

      if (pending.streamKey) {
        const idx = chat.messages.findIndex(m => m._key === pending.streamKey)
        if (idx >= 0) {
          chat.messages[idx].content = finalContent
        }
      }
      chat.setCmdStreaming(sid, false)
      chat.clearCmdStreamCache(sid)
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

    async function onScrollLoadMore() {
      const el = messagesContainer.value
      if (!el) return
      vs.setContainer(el)
      vs.onScroll()
      _isNearBottom.value = vs.isNearBottom.value
      if (el.scrollTop === 0 && !loadingMore.value && hasMoreMessages.value && activeSessionId.value) {
        const oldScrollHeight = el.scrollHeight
        const added = await chat.loadMoreMessages(activeSessionId.value)
        vs.shiftAfterPrepend(added || 0)
        nextTick(() => {
          if (messagesContainer.value) {
            messagesContainer.value.scrollTop = messagesContainer.value.scrollHeight - oldScrollHeight
          }
        })
      }
    }

    let resizeObserver = null

    // Evitar el deep watcher sobre todos los messages: en streaming se muta
    // content/thinking del mensaje activo por cada chunk (chat.js:190,200), y un
    // watch deep recorre el array completo O(n) en cada chunk. El scroll durante
    // streaming ya lo cubren currentChunk/ocChunk; aquí solo reaccionamos a la
    // adición/eliminación de mensajes (cambio de longitud).
    watch(() => messages.value.length, () => scrollToBottom(false))
    watch([currentChunk, ocChunk], () => scrollToBottom(false))

    watch(activeSessionId, (newId, oldId) => {
      if (oldId) {
        ocStore.saveCurrentToMap(oldId, { showTerminal: showAgentTerminal.value, terminalContent: terminalContent.value })
        ocStore.setSessionShowTerminal(oldId, showAgentTerminal.value)
      }
      if (newId) {
        vs.reset()
        ocStore.activateSession(newId)
        ocStreaming.value = chat.getIsOcStreaming(newId)
        streamingConsole.value = false
        streamingApi._syncStreamData(newId)
        showAgentTerminal.value = ocStore.getSessionShowTerminal(newId)
        const savedTerminal = ocStore.getSessionExtra(newId, 'terminalContent')
        if (savedTerminal && !terminalContent.value) {
          terminalContent.value = savedTerminal
        }
        if (chat._hasTerminal(newId)) {
          // terminal already tracked, XtermTerminal will reconnect via findOrCreateTerminal
        }
        ocStore.restoreActiveAgents(newId)
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
        vs.setContainer(messagesContainer.value)
        vs.reset()
        resizeObserver = new ResizeObserver(() => {
          if (messagesContainer.value) {
            vs.setContainer(messagesContainer.value)
            vs.onScroll()
            _isNearBottom.value = vs.isNearBottom.value
            if (_isNearBottom.value) {
              messagesContainer.value.scrollTop = messagesContainer.value.scrollHeight
            }
          }
        })
        resizeObserver.observe(messagesContainer.value)
        messagesContainer.value.addEventListener('scroll', onScrollLoadMore)
      }
      loadTicketInfo()
      gitStore.loadZoom('chat')
      fetchGitBranch()
      await devInstanceStore.fetchStatus()
      if (activeSessionId.value) {
        ocStore.restoreActiveAgents(activeSessionId.value)
      }
      ui.ocMaximized = false
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

    return {
      chat, activeSessionId, messages, streaming, currentChunk, currentThinking,
      sessions, loadingMore, hasMoreMessages, input, gitStore, ocStore,
      visibleMessages: vs.visibleMessages,
      topPad: vs.topPad,
      bottomPad: vs.bottomPad,
      setMsgEl: vs.setMsgEl,
      ocStreaming, terminalContent, sessionCwd, terminalSessions, onTerminalClose, onTerminalReady, onTerminalExit,
      ticketInfo, ocMaximized, isOcSessionActive,
      deteccionState, abortDeteccion,
      ctxMenu, rawMsgKeys, msgKey,
      messagesContainer,
      send, handleFabSend,
      onControlConfirm,
      onContextMenu, closeCtxMenu, toggleRawView, copyPlainText, deleteMessage,
      showAgentTerminal, clearAgent, closeAgent, ocAgents, getAgentTerminalContent,
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
