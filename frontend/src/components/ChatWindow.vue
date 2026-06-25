<template>
  <div class="d-flex flex-column h-100 overflow-x-hidden" @click="closeCtxMenu">
    <div v-if="activeSessionId" class="ticket-info-bar px-3 d-flex align-items-center gap-2" :class="ticketInfo ? priorityClass(ticketInfo.priority_id) : 'priority-none'">
      <template v-if="ticketInfo">
        <span class="priority-dot" :class="priorityClass(ticketInfo.priority_id)"></span>
        <span class="ticket-id">#{{ ticketInfo.redmine_id }}</span>
        <span class="ticket-sep text-muted">—</span>
        <span class="ticket-subject text-truncate">{{ ticketInfo.subject }}</span>
      </template>
      <span v-if="gitStore.currentBranch && gitStore.currentBranch !== 'Sin repo'" class="branch-name ms-2">· rama: {{ gitStore.currentBranch }}</span>
      <div class="ms-auto d-flex align-items-center gap-2">
        <button class="btn btn-sm btn-outline-danger px-2" @click="clearChat" title="Limpiar chat">🗑️</button>
        <div class="zoom-controls d-flex align-items-center gap-1">
          <button class="btn btn-sm btn-outline-secondary px-1 zoom-btn" @click="zoomOut" :disabled="gitStore.chatZoom <= 50" title="Alejar">−</button>
          <span class="zoom-level small" @click="gitStore.chatZoom = 100; gitStore.saveZoom('chat', 100)" style="cursor:pointer; min-width:36px; text-align:center;" title="Restablecer zoom">{{ gitStore.chatZoom }}%</span>
          <button class="btn btn-sm btn-outline-secondary px-1 zoom-btn" @click="zoomIn" :disabled="gitStore.chatZoom >= 200" title="Acercar">+</button>
        </div>
      </div>
    </div>
    <div class="flex-grow-1 overflow-hidden position-relative" style="min-height: 0;">
      <div v-if="!activeSessionId" class="text-center text-muted mt-5 p-3">
        <h5 class="text-white">Selecciona o crea un nuevo chat</h5>
      </div>
      <div v-else class="messages-pages" ref="messagesContainer" :style="{ fontSize: gitStore.chatZoom + '%' }">
        <ChatMessage v-for="m in messages" :key="m.id || m._key" :msg="m" :raw-msg-keys="rawMsgKeys" @control-confirm="onControlConfirm" @contextmenu="onContextMenu" />
        <div v-if="streaming" class="messages-page-item streaming-msg-wrapper">
          <div class="d-inline-block rounded-3 p-3 text-start" style="max-width: 80%; background: #1a2744; border: 1px solid #374151; color: #e0e0e0;">
            <div v-if="currentThinking" class="mb-2">
              <button class="btn btn-sm w-100 text-start btn-outline-argentina" data-bs-toggle="collapse" data-bs-target="#think-stream">
                🧠 Razonando...
              </button>
              <div class="collapse show mt-1" id="think-stream">
                <pre class="mb-0 small text-muted" style="white-space: pre-wrap;">{{ currentThinking }}</pre>
              </div>
            </div>
            <div style="white-space: pre-wrap;">{{ currentChunk }}<span class="blink">▌</span></div>
          </div>
        </div>
      </div>
    </div>
    <div v-if="deteccionState.running" class="border-top p-2" style="border-color: #75AADB; background: #0d1b2a;">
      <div class="d-flex align-items-center gap-2">
        <div class="flex-grow-1 small text-truncate" style="color: #e0e0e0;">
          📄 {{ deteccionState.processed + 1 }}/{{ deteccionState.total }}: {{ deteccionState.current }}
        </div>
        <button class="btn btn-sm btn-outline-danger flex-shrink-0" @click="abortDeteccion">⏹ Detener</button>
      </div>
    </div>
    <div class="border-top p-2" style="border-color: #374151;" v-if="activeSessionId">
      <form @submit.prevent="send" class="d-flex gap-2">
        <textarea
          v-model="input"
          class="form-control flex-grow-1 bg-dark text-light border-secondary"
          placeholder="Escribe tu mensaje..."
          :disabled="streaming || executing"
          rows="1"
          style="resize: vertical; max-height: 150px;"
          @keydown.enter.exact.prevent="send"
        ></textarea>
        <button class="btn btn-argentina" :disabled="streaming || executing || !input.trim()">Enviar</button>
      </form>
    </div>
    <div v-if="ctxMenu.show" class="context-menu-backdrop" @click="closeCtxMenu" @contextmenu.prevent="closeCtxMenu"></div>
    <div v-if="ctxMenu.show" class="context-menu" :style="{ left: ctxMenu.x + 'px', top: ctxMenu.y + 'px' }" @click.stop>
      <div class="context-menu-item" @click="toggleRawView(ctxMenu.msg)">{{ rawMsgKeys.has(msgKey(ctxMenu.msg)) ? '🎨 Vista formateada' : '📄 Vista texto plano' }}</div>
      <div class="context-menu-item text-danger" @click="deleteMessage(ctxMenu.msg)">🗑️ Eliminar mensaje</div>
    </div>
  </div>
</template>

<script>
import { ref, reactive, watch, nextTick, onMounted, onUnmounted } from 'vue'
import { storeToRefs } from 'pinia'
import { useChatStore } from '../stores/chat.js'
import { useCommandStore } from '../stores/command.js'
import { useModalStore } from '../stores/modal.js'
import { useOpencodeStore } from '../stores/opencode.js'
import { useSettingsStore } from '../stores/settings.js'
import { useGitStore } from '../stores/git.js'
import { useRedmineCommentsStore } from '../stores/redmineComments.js'
import { deteccionState, abortDeteccion } from '../composables/commands/deteccionFuncionalidades.js'
import { useCommandRegistry } from '../composables/useCommandRegistry.js'
import { useProjectVariables } from '../composables/useProjectVariables.js'
import ChatMessage from './ChatMessage.vue'
import HelpContent from './HelpModal.vue'
import FuncionalidadWizard from './FuncionalidadWizard.vue'

export default {
  components: { ChatMessage },
  setup() {
    const chat = useChatStore()
    const cmdStore = useCommandStore()
    const modal = useModalStore()
    const ocStore = useOpencodeStore()
    const redmineComments = useRedmineCommentsStore()
    const gitStore = useGitStore()
    const { find } = useCommandRegistry()
    const { getVariables, interpolate } = useProjectVariables()
    const { activeSessionId, messages, streaming, executing, currentChunk, currentThinking, sessions } = storeToRefs(chat)
    const input = ref('')
    const messagesContainer = ref(null)
    const ocStreaming = ref(false)
    const ocChunk = ref('')
    const ocThinking = ref('')
    const _streamSessionId = ref(null)
    const ticketInfo = ref(null)

    function fetchGitBranch() {
      return gitStore.fetchGitBranch(chat.activeSessionId)
    }

    async function _getProyectoId() {
      const sid = chat.activeSessionId
      if (!sid) return null
      try {
        const res = await fetch(`/api/proyecto/session/${sid}`, { credentials: 'include' })
        const data = await res.json()
        return data.proyectoId || null
      } catch (err) {
        console.error('Error al obtener proyecto de sesión:', err.message)
        return null
      }
    }

    async function resolveInput(text) {
      if (!text || !text.includes('{{')) return text
      const proyectoId = await _getProyectoId()
      if (!proyectoId) return text
      const variables = await getVariables(proyectoId)
      return interpolate(text, variables)
    }

    function loadZoom() {
      return gitStore.loadZoom('chat')
    }

    function saveZoom(val) {
      return gitStore.saveZoom('chat', val)
    }

    function zoomIn() {
      gitStore.zoomIn('chat')
    }

    function zoomOut() {
      gitStore.zoomOut('chat')
    }

    function _isActiveSession(sid) {
      return sid && Number(chat.activeSessionId) === Number(sid)
    }

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
        }
      } catch (err) {
        console.error('Error al cargar info del ticket:', err)
      }
    }

    function priorityClass(priorityId) {
      if (!priorityId) return 'priority-none'
      if (priorityId <= 1) return 'priority-low'
      if (priorityId === 2) return 'priority-normal'
      if (priorityId === 3) return 'priority-high'
      if (priorityId >= 5) return 'priority-immediate'
      if (priorityId >= 4) return 'priority-urgent'
      return 'priority-none'
    }

    const docUpdateProyectoId = ref('')
    const docUpdateType = ref('')
    const ctxMenu = reactive({ show: false, x: 0, y: 0, msg: null })
    const rawMsgKeys = reactive(new Set())

    async function send() {
      let raw = input.value.trim()
      if (!raw || !chat.activeSessionId) return
      input.value = ''

      raw = await resolveInput(raw)

      if (raw.startsWith('/')) {
        executeCommand(raw)
      } else if (ocStore.ocSessionId) {
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

    async function sendToOpencode(prompt) {
      if (!ocStore.selectedProvider) {
        chat.pushMessage({
          role: 'opencode_info',
          content: JSON.stringify({ type: 'info', message: 'No hay sesión OpenCode configurada. Ejecutá /dev_opencode_iniciar primero.' }),
          _key: 'info-' + Date.now(),
        })
        return
      }
      await opencodeStreamPrompt(
        chat.activeSessionId,
        prompt,
        ocStore.selectedProvider,
        ocStore.selectedModel,
        ocStore.selectedThinking,
        ocStore.selectedMode,
        ocStore.selectedTemperature,
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
      ocStreaming.value = false
      if (chat.activeSessionId) {
        chat.setSessionStatus(chat.activeSessionId, 'idle')
      }
      chat.pushMessage({
        role: 'opencode_info',
        content: JSON.stringify({ type: 'info', message: '⏹ Tarea detenida por el usuario.' }),
        _key: 'abort-' + Date.now(),
      })
      ocStore.messageQueue.value = []
    }

    function onContextMenu(e, msg) {
      ctxMenu.show = true
      ctxMenu.x = e.clientX
      ctxMenu.y = e.clientY
      ctxMenu.msg = msg
    }

    function msgKey(msg) {
      return msg.id || msg._key
    }

    function toggleRawView(msg) {
      const key = msgKey(msg)
      if (rawMsgKeys.has(key)) {
        rawMsgKeys.delete(key)
      } else {
        rawMsgKeys.add(key)
      }
    }

    function closeCtxMenu() {
      ctxMenu.show = false
    }

    async function deleteMessage(msg) {
      try {
        await chat.deleteMessage(chat.activeSessionId, msg)
      } catch (err) {
        console.error('Error al eliminar mensaje:', err)
      }
      closeCtxMenu()
    }

    async function clearChat() {
      const confirmed = confirm('¿Eliminar todos los mensajes de este chat? Esta acción no se puede deshacer.')
      if (!confirmed) return
      await chat.clearMessages(chat.activeSessionId)
    }

    async function opencodeStreamPrompt(sessionId, prompt, provider, model, thinking, mode, temperature) {
      ocStreaming.value = true
      ocChunk.value = ''
      ocThinking.value = ''
      _streamSessionId.value = sessionId
      if (sessionId) chat.setSessionStatus(sessionId, 'executing')

      const streamMsg = await addMessage('opencode_stream', '', { streaming: true })
      streamMsg._key = 'stream-' + Date.now()

      const _buildStartTime = mode === 'Build' ? new Date().toISOString() : null

      await ocStore.streamPrompt(sessionId, prompt, provider, model, thinking, mode, temperature, {
        onChunk(content) {
          if (_isActiveSession(sessionId)) {
            ocChunk.value += content
            const idx = chat.messages.findIndex((m) => m._key === streamMsg._key)
            if (idx >= 0) chat.messages[idx].content = ocChunk.value
          }
        },
        onThinking(content) {
          if (_isActiveSession(sessionId)) {
            ocThinking.value += content
            const idx = chat.messages.findIndex((m) => m._key === streamMsg._key)
            if (idx >= 0) chat.messages[idx].thinking = ocThinking.value
          }
        },
        onControl(control) {
          const controlMsg = {
            role: 'opencode_control',
            content: JSON.stringify(control),
            controlData: control,
            _key: 'control-' + Date.now(),
          }
          chat._saveMessageToDb(sessionId, controlMsg)
          if (_isActiveSession(sessionId)) {
            chat.pushMessage(controlMsg)
          } else {
            chat.pendingNotifications[sessionId] = Date.now()
          }
        },
        async onDone(json, fullText) {
          ocStreaming.value = false
          if (sessionId) chat.setSessionStatus(sessionId, 'idle')
          const content = json.fullResponse || fullText || '(sin respuesta)'
          const thinking = json.thinking || ocThinking.value || null
          chat._saveMessageToDb(sessionId, { role: 'opencode_result', content, thinking })
          if (!_isActiveSession(sessionId)) {
            chat.pendingNotifications[sessionId] = Date.now()
            return
          }

          const idx = chat.messages.findIndex((m) => m._key === streamMsg._key)
          if (idx >= 0) {
            chat.messages[idx] = {
              role: 'opencode_result',
              content,
              thinking,
              _key: 'result-' + Date.now(),
            }
          }
          fetchGitBranch()

          if (mode === 'Build' && _buildStartTime) {
            try {
              const sinceParam = _buildStartTime
              const res = await fetch(`/api/playwright-logs/console?chat_session_id=${sessionId}&since=${encodeURIComponent(sinceParam)}&types=error,warn&limit=20`, { credentials: 'include' })
              const newLogs = await res.json()
              if (Array.isArray(newLogs) && newLogs.length > 0) {
                const errors = newLogs.filter(l => l.type === 'error')
                const warnings = newLogs.filter(l => l.type === 'warn')
                chat.pushMessage({
                  role: 'opencode_info',
                  content: JSON.stringify({
                    type: 'console_errors',
                    errors: newLogs,
                    summary: `Se detectaron ${errors.length} error(es) y ${warnings.length} advertencia(s) en la consola del navegador`,
                  }),
                  _key: 'console-err-' + Date.now(),
                })
              }
            } catch (err) {
              console.error('Error al verificar console logs:', err.message)
            }
          }

          const next = ocStore.messageQueue.shift()
          if (next && _isActiveSession(sessionId)) {
            const queueMsg = chat.messages.find((m) => m.role === 'opencode_info' && m.content?.includes('encolado'))
            if (queueMsg) {
              const qIdx = chat.messages.indexOf(queueMsg)
              if (qIdx >= 0) chat.messages.splice(qIdx, 1)
            }
            sendToOpencode(next)
            return
          }
          chat.pushMessage({
            role: 'opencode_control',
            controlData: {
              controlId: 'followup-' + Date.now(),
              controlType: 'opencode_form',
              models: ocStore.getModelsForProvider(ocStore.selectedProvider),
              modelValue: ocStore.selectedModel || '',
              thinkingOptions: ocStore.thinkingOptions,
              thinkingValue: ocStore.selectedThinking || '',
              temperatureOptions: ocStore.temperatureOptions,
              temperatureValue: ocStore.selectedTemperature || ocStore.savedTemperature || '0.7',
              modeValue: ocStore.selectedMode || 'Build',
              placeholder: 'Escribe otro mensaje para OpenCode...',
              rows: 3,
            },
            _key: 'control-' + Date.now(),
          })
        },
        onError(msg) {
          ocStreaming.value = false
          if (sessionId) chat.setSessionStatus(sessionId, 'error')
          chat._saveMessageToDb(sessionId, { role: 'opencode_result', content: `[Error: ${msg}]` })
          if (_isActiveSession(sessionId)) {
            const idx = chat.messages.findIndex((m) => m._key === streamMsg._key)
            if (idx >= 0) {
              chat.messages[idx].streaming = false
              chat.messages[idx].role = 'opencode_result'
              chat.messages[idx].content = '[Error: ' + msg + ']'
            }
          } else {
            chat.pendingNotifications[sessionId] = Date.now()
          }
        },
      })
    }

    async function opencodeStreamPromptCommit(sessionId, prompt, provider, model, thinking, mode, temperature) {
      ocStreaming.value = true
      ocChunk.value = ''
      ocThinking.value = ''
      _streamSessionId.value = sessionId
      if (sessionId) chat.setSessionStatus(sessionId, 'executing')

      const streamMsg = await addMessage('opencode_stream', '', { streaming: true })
      streamMsg._key = 'stream-' + Date.now()

      await ocStore.streamPrompt(sessionId, prompt, provider, model, thinking, mode, temperature, {
        onChunk(content) {
          if (_isActiveSession(sessionId)) {
            ocChunk.value += content
            const idx = chat.messages.findIndex((m) => m._key === streamMsg._key)
            if (idx >= 0) chat.messages[idx].content = ocChunk.value
          }
        },
        onThinking(content) {
          if (_isActiveSession(sessionId)) {
            ocThinking.value += content
            const idx = chat.messages.findIndex((m) => m._key === streamMsg._key)
            if (idx >= 0) chat.messages[idx].thinking = ocThinking.value
          }
        },
        onControl(control) {
          const controlMsg = {
            role: 'opencode_control',
            content: JSON.stringify(control),
            controlData: control,
            _key: 'control-' + Date.now(),
          }
          chat._saveMessageToDb(sessionId, controlMsg)
          if (_isActiveSession(sessionId)) {
            chat.pushMessage(controlMsg)
          } else {
            chat.pendingNotifications[sessionId] = Date.now()
          }
        },
        async onDone(json, fullText) {
          const opencodeResponse = json.fullResponse || fullText || '(sin respuesta)'
          const thinking = json.thinking || ocThinking.value || null
          chat._saveMessageToDb(sessionId, { role: 'opencode_result', content: opencodeResponse, thinking })
          ocStreaming.value = false
          if (sessionId) chat.setSessionStatus(sessionId, 'idle')
          if (!_isActiveSession(sessionId)) {
            chat.pendingNotifications[sessionId] = Date.now()
            return
          }

          try {
            const systemPrompt = 'Eres un asistente que reduce mensajes de commit. Recibes un mensaje de commit y debes acortarlo a un máximo de 256 caracteres manteniendo el significado y la claridad. Devuelve ÚNICAMENTE el mensaje reducido, sin explicaciones ni formato adicional.'

            const res = await fetch('/api/chat/refine', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              credentials: 'include',
              body: JSON.stringify({ text: opencodeResponse, systemPrompt, sessionId }),
            })

            if (!res.ok) {
              let errMsg = 'Error al reducir mensaje de commit'
              try { const errData = await res.json(); if (errData.error) errMsg = errData.error } catch {}
              throw new Error(errMsg)
            }

            let refinedText = ''
            ocChunk.value = ''
            ocThinking.value = ''

            const reader = res.body.getReader()
            const decoder = new TextDecoder()
            let buf = ''

            while (true) {
              const { done, value } = await reader.read()
              if (done) break
              buf += decoder.decode(value, { stream: true })
              const lines = buf.split('\n')
              buf = lines.pop() || ''

              for (const line of lines) {
                const t = line.trim()
                if (!t || !t.startsWith('data: ')) continue
                try {
                  const j = JSON.parse(t.slice(6))
                  if (j.type === 'response') {
                    refinedText += j.content
                    if (_isActiveSession(sessionId)) {
                      ocChunk.value += j.content
                      const idx = chat.messages.findIndex((m) => m._key === streamMsg._key)
                      if (idx >= 0) {
                        chat.messages[idx].content = refinedText
                      }
                    }
                  } else if (j.type === 'thinking') {
                    if (_isActiveSession(sessionId)) ocThinking.value += j.content
                  } else if (j.type === 'error') {
                    throw new Error(j.content)
                  }
                } catch (e) {
                  if (e.message && e.message !== 'Unexpected end of JSON input') throw e
                }
              }
            }

            ocStreaming.value = false
            if (sessionId) chat.setSessionStatus(sessionId, 'idle')

            if (_isActiveSession(sessionId)) {
              const idx = chat.messages.findIndex((m) => m._key === streamMsg._key)
              if (idx >= 0) {
                const finalMessage = refinedText || opencodeResponse
                chat.messages[idx] = {
                  role: 'opencode_control',
                  controlData: {
                    controlId: 'commit-result-' + Date.now(),
                    controlType: 'commit_result',
                    message: finalMessage,
                    loading: false,
                    modo_envio: 'encolar',
                  },
                  _key: 'control-' + Date.now(),
                }
              }
            }
          } catch (err) {
            console.error('Error al refinar mensaje de commit:', err.message)
            ocStreaming.value = false
            if (sessionId) chat.setSessionStatus(sessionId, 'idle')
            if (_isActiveSession(sessionId)) {
              const idx = chat.messages.findIndex((m) => m._key === streamMsg._key)
              if (idx >= 0) {
                const fallbackMessage = opencodeResponse + (err ? '\n\n[Error al reducir: ' + err.message + ']' : '')
                chat.messages[idx] = {
                  role: 'opencode_control',
                  controlData: {
                    controlId: 'commit-result-' + Date.now(),
                    controlType: 'commit_result',
                    message: fallbackMessage,
                    loading: false,
                    modo_envio: 'encolar',
                  },
                  _key: 'control-' + Date.now(),
                }
              }
            }
          }
          fetchGitBranch()
        },
        onError(msg) {
          ocStreaming.value = false
          if (sessionId) chat.setSessionStatus(sessionId, 'error')
          chat._saveMessageToDb(sessionId, { role: 'opencode_result', content: `[Error: ${msg}]` })
          if (_isActiveSession(sessionId)) {
            const idx = chat.messages.findIndex((m) => m._key === streamMsg._key)
            if (idx >= 0) {
              chat.messages[idx].streaming = false
              chat.messages[idx].role = 'opencode_result'
              chat.messages[idx].content = '[Error: ' + msg + ']'
            }
          } else {
            chat.pendingNotifications[sessionId] = Date.now()
          }
        },
      })
    }

    async function opencodeStreamPromptTestingNotes(sessionId, prompt, provider, model, thinking, mode, temperature) {
      if (!_isActiveSession(sessionId)) {
        console.log('[testing-notes] sesión inactiva, ignorando')
        return
      }
      ocStreaming.value = true
      if (sessionId) chat.setSessionStatus(sessionId, 'ai-thinking')
      ocChunk.value = ''
      ocThinking.value = ''

      const streamMsg = {
        role: 'opencode_stream',
        content: '',
        thinking: null,
        streaming: true,
        _key: 'stream-' + Date.now(),
      }
      chat.pushMessage(streamMsg)

      await ocStore.streamPrompt(sessionId, prompt, provider, model, thinking, mode, temperature, {
        onChunk(text) {
          if (!_isActiveSession(sessionId)) return
          ocChunk.value += text
          const idx = chat.messages.findIndex((m) => m._key === streamMsg._key)
          if (idx >= 0) chat.messages[idx].content = ocChunk.value
        },
        onThinking(text) {
          if (!_isActiveSession(sessionId)) return
          ocThinking.value += text
          const idx = chat.messages.findIndex((m) => m._key === streamMsg._key)
          if (idx >= 0) chat.messages[idx].thinking = ocThinking.value
        },
        onControl(control) {
          if (!_isActiveSession(sessionId)) return
          console.log('[testing-notes] control:', control)
        },
        async onDone(json, fullText) {
          const opencodeResponse = json.fullResponse || fullText || '(sin respuesta)'
          const thinking = json.thinking || ocThinking.value || null
          chat._saveMessageToDb(sessionId, { role: 'opencode_result', content: opencodeResponse, thinking })
          ocStreaming.value = false
          if (sessionId) chat.setSessionStatus(sessionId, 'idle')
          if (!_isActiveSession(sessionId)) {
            chat.pendingNotifications[sessionId] = Date.now()
            return
          }

          if (_isActiveSession(sessionId)) {
            const idx = chat.messages.findIndex((m) => m._key === streamMsg._key)
            if (idx >= 0) {
              chat.messages[idx] = {
                role: 'opencode_control',
                controlData: {
                  controlId: 'ambientes-diff-comment-' + Date.now(),
                  controlType: 'ambientes_diff_comment',
                  message: opencodeResponse,
                  sourceEnv: testingNotesData.origen,
                  targetEnv: testingNotesData.destino,
                  modo_envio: 'encolar',
                  fromTestingNotes: true,
                },
                _key: 'control-' + Date.now(),
              }
            }
          }
        },
        onError(msg) {
          console.error('[testing-notes] error:', msg)
          ocStreaming.value = false
          if (sessionId) chat.setSessionStatus(sessionId, 'idle')
          chat._saveMessageToDb(sessionId, { role: 'opencode_result', content: `[Error: ${msg}]` })
          if (_isActiveSession(sessionId)) {
            const idx = chat.messages.findIndex((m) => m._key === streamMsg._key)
            if (idx >= 0) {
              chat.messages[idx].streaming = false
              chat.messages[idx].role = 'opencode_result'
              chat.messages[idx].content = '[Error: ' + msg + ']'
            }
          } else {
            chat.pendingNotifications[sessionId] = Date.now()
          }
        },
      })
    }

    const DOC_LABELS = {
      base_datos: 'Base de Datos',
      subproyectos: 'Subproyectos',
      endpoints: 'Endpoints',
      web_sockets: 'WebSockets',
      funcionalidades: 'Funcionalidades',
    }

    async function opencodeStreamPromptDocUpdate(sessionId, prompt, provider, model, thinking, mode, temperature, proyectoId, tipo) {
      ocStreaming.value = true
      ocChunk.value = ''
      ocThinking.value = ''
      _streamSessionId.value = sessionId
      if (sessionId) chat.setSessionStatus(sessionId, 'executing')

      const streamMsg = await addMessage('opencode_stream', '', { streaming: true })
      streamMsg._key = 'stream-' + Date.now()

      await ocStore.streamPrompt(sessionId, prompt, provider, model, thinking, mode, temperature, {
        onChunk(content) {
          if (_isActiveSession(sessionId)) {
            ocChunk.value += content
            const idx = chat.messages.findIndex((m) => m._key === streamMsg._key)
            if (idx >= 0) chat.messages[idx].content = ocChunk.value
          }
        },
        onThinking(content) {
          if (_isActiveSession(sessionId)) {
            ocThinking.value += content
            const idx = chat.messages.findIndex((m) => m._key === streamMsg._key)
            if (idx >= 0) chat.messages[idx].thinking = ocThinking.value
          }
        },
        onControl(control) {
          const controlMsg = {
            role: 'opencode_control',
            content: JSON.stringify(control),
            controlData: control,
            _key: 'control-' + Date.now(),
          }
          chat._saveMessageToDb(sessionId, controlMsg)
          if (_isActiveSession(sessionId)) {
            chat.pushMessage(controlMsg)
          } else {
            chat.pendingNotifications[sessionId] = Date.now()
          }
        },
        async onDone(json, fullText) {
          ocStreaming.value = false
          if (sessionId) chat.setSessionStatus(sessionId, 'idle')
          const fullResponse = json.fullResponse || fullText || '(sin respuesta)'
          const thinking = json.thinking || ocThinking.value || null
          chat._saveMessageToDb(sessionId, { role: 'opencode_result', content: fullResponse, thinking })
          if (_isActiveSession(sessionId)) {
            const idx = chat.messages.findIndex((m) => m._key === streamMsg._key)
            if (idx >= 0) {
              chat.messages[idx].streaming = false
              chat.messages[idx].role = 'opencode_result'
              chat.messages[idx].content = fullResponse
              chat.messages[idx].thinking = thinking
            }

            try {
              const label = DOC_LABELS[tipo] || tipo
              const res = await fetch(`/api/documentacion/${tipo}/${encodeURIComponent(proyectoId)}`, {
                method: 'PUT',
                headers: { 'Content-Type': 'application/json' },
                credentials: 'include',
                body: JSON.stringify({ data: fullResponse }),
              })
              if (!res.ok) {
                const errData = await res.json()
                throw new Error(errData.error || 'Error al guardar documentación')
              }
              chat.pushMessage({
                role: 'result',
                content: `Documentación de ${label} actualizada correctamente para el proyecto "${proyectoId}".`,
                _key: 'result-' + Date.now(),
              })
            } catch (err) {
              console.error('Error al guardar documentación:', err.message)
              chat.pushMessage({
                role: 'result',
                content: 'Error al guardar documentación: ' + err.message,
                _key: 'result-' + Date.now(),
              })
            }
          } else {
            chat.pendingNotifications[sessionId] = Date.now()
          }
        },
        onError(msg) {
          ocStreaming.value = false
          if (sessionId) chat.setSessionStatus(sessionId, 'error')
          chat._saveMessageToDb(sessionId, { role: 'opencode_result', content: `[Error: ${msg}]` })
          if (_isActiveSession(sessionId)) {
            const idx = chat.messages.findIndex((m) => m._key === streamMsg._key)
            if (idx >= 0) {
              chat.messages[idx].content = '[Error: ' + msg + ']'
              chat.messages[idx].streaming = false
            }
          } else {
            chat.pendingNotifications[sessionId] = Date.now()
          }
        },
      })
    }

    async function onControlConfirm({ controlId, value }) {
      // Find the control message to determine type
      const controlMsg = chat.messages.find((m) => m.controlData && m.controlData.controlId === controlId)
      const controlType = controlMsg && controlMsg.controlData ? controlMsg.controlData.controlType : ''
      const stepType = controlMsg && controlMsg.controlData ? controlMsg.controlData.stepType : ''

      if (stepType === 'opencode_setup') {
        await handleOpencodeSetup(controlId, value, controlMsg)
      } else if (stepType === 'generar_commit_setup') {
        await handleGenerarCommitSetup(controlId, value, controlMsg)
      } else if (stepType === 'ambientes_diff_testing_setup') {
        await handleAmbientesDiffTestingSetup(controlId, value, controlMsg)
      } else if (stepType === 'documentacion_update') {
        await handleDocumentacionUpdate(controlId, value, controlMsg)
      } else if (stepType === 'deteccion_model_setup') {
        const subStepType = controlMsg.controlData.subStepType
        if (subStepType === 'model') {
          const { startDeteccionProcessing } = await import('../composables/commands/deteccionFuncionalidades.js')
          const ocStore = useOpencodeStore()
          await ocStore.select('model', value)
          const idx = chat.messages.findIndex((m) => m.controlData && m.controlData.controlId === controlId)
          if (idx >= 0) {
            chat.messages[idx] = {
              role: 'opencode_confirmed',
              content: value,
              _key: 'confirmed-' + Date.now(),
            }
          }
          chat.pushMessage({
            role: 'opencode_control',
            controlData: {
              controlId: 'df-thinking-' + Date.now(),
              controlType: 'select',
              stepType: 'deteccion_model_setup',
              subStepType: 'thinking',
              options: [
                { label: 'Low — mínimo esfuerzo de razonamiento (Flash)', value: 'low' },
                { label: 'Medium — equilibrio velocidad/profundidad', value: 'medium' },
                { label: 'High — máximo razonamiento profundo', value: 'high' },
              ],
              placeholder: 'Selecciona nivel de pensamiento...',
              preselect: ocStore.savedThinking || 'low',
            },
            _key: 'ctrl-thinking-' + Date.now(),
          })
        } else if (subStepType === 'thinking') {
          const { startDeteccionProcessing } = await import('../composables/commands/deteccionFuncionalidades.js')
          const ocStore = useOpencodeStore()
          await ocStore.select('thinking', value)
          const idx = chat.messages.findIndex((m) => m.controlData && m.controlData.controlId === controlId)
          if (idx >= 0) {
            chat.messages[idx] = {
              role: 'opencode_confirmed',
              content: value,
              _key: 'confirmed-' + Date.now(),
            }
          }
          const model = ocStore.selectedModel || 'deepseek-chat'
          await startDeteccionProcessing(chat.activeSessionId, chat, model, value)
        }
        return
      } else if (stepType === 'ticket_descripcion') {
        if (controlType === 'followup' || controlType === 'opencode_form') {
          const { model, thinking, mode, temperature, prompt } = value
          if (!prompt) return
          ocStore.selectedModel = model || ocStore.selectedModel
          ocStore.selectedThinking = thinking || ocStore.selectedThinking
          ocStore.selectedMode = mode || ocStore.selectedMode
          ocStore.selectedTemperature = temperature || ocStore.selectedTemperature
          descripcionData.mode = ocStore.selectedMode
          await opencodeStreamDescripcionFollowup(chat.activeSessionId, prompt, controlMsg.controlData.ticket, temperature || descripcionData.temperature || ocStore.selectedTemperature || '')
          return
        } else if (value === null) {
          const idx = chat.messages.findIndex((m) => m.controlData && m.controlData.controlId === controlId)
          if (idx >= 0) {
            chat.messages[idx] = { role: 'result', content: 'Edición de descripción cancelada.', _key: 'result-' + Date.now() }
          }
          return
        } else {
          await handleTicketDescripcion(controlId, value, controlMsg)
          return
        }
      } else if (stepType === 'repo_crear_rama') {
        await handleRepoCrearRama(controlId, value, controlMsg)
        return
      } else if (controlType === 'descripcion_result') {
        if (value === null) {
          const idx = chat.messages.findIndex((m) => m.controlData && m.controlData.controlId === controlId)
          if (idx >= 0) {
            chat.messages[idx] = { role: 'result', content: 'Edición de descripción cancelada.', _key: 'result-' + Date.now() }
          }
        } else if (value.action === 'accept') {
          await refinarDescripcionConDeepSeek(controlId, controlMsg, value.description)
        } else if (value.action === 'retry') {
          await regenerateDescripcion(controlId, controlMsg)
        }
        return
      } else if (controlType === 'refinar_result') {
        if (value === null) {
          const idx = chat.messages.findIndex((m) => m.controlData && m.controlData.controlId === controlId)
          if (idx >= 0) {
            chat.messages[idx] = { role: 'result', content: 'Descripción descartada.', _key: 'result-' + Date.now() }
          }
        } else if (value.action === 'accept') {
          try {
            const res = await fetch(`/api/tickets/session/${chat.activeSessionId}`, {
              method: 'PUT',
              headers: { 'Content-Type': 'application/json' },
              credentials: 'include',
              body: JSON.stringify({ description: value.description }),
            })
            const data = await res.json()
            const idx = chat.messages.findIndex((m) => m.controlData && m.controlData.controlId === controlId)
            if (idx >= 0) {
              if (data.success) {
                chat.messages[idx] = {
                  role: 'result',
                  content: `✓ Descripción del ticket #${data.ticket.redmine_id} actualizada correctamente.`,
                  _key: 'result-' + Date.now(),
                }
              } else {
                chat.messages[idx] = {
                  role: 'result',
                  content: `Error: ${data.error || 'Error al actualizar la descripción'}`,
                  _key: 'err-' + Date.now(),
                }
              }
            }
          } catch (err) {
            console.error('Error al actualizar descripción:', err)
            const idx = chat.messages.findIndex((m) => m.controlData && m.controlData.controlId === controlId)
            if (idx >= 0) {
              chat.messages[idx] = {
                role: 'result',
                content: 'Error de conexión al actualizar la descripción.',
                _key: 'err-' + Date.now(),
              }
            }
          }
        } else if (value.action === 'retry') {
          await restartTicketDescripcion()
        }
        return
      } else if (controlType === 'commit_result') {
        if (value === null) {
          const idx = chat.messages.findIndex((m) => m.controlData && m.controlData.controlId === controlId)
          if (idx >= 0) {
            chat.messages[idx] = {
              role: 'result',
              content: 'Generación de commit cancelada.',
              _key: 'result-' + Date.now(),
            }
          }
        } else if (value.action === 'retry') {
          await regenerateCommit(controlId, controlMsg)
        } else if (value.action === 'confirm') {
          await executeCommit(controlId, controlMsg, value.message, value.addComment, value.modo_envio)
        }
        return
      } else if (controlType === 'ambientes_diff_comment') {
        if (value === null) {
          const idx = chat.messages.findIndex((m) => m.controlData && m.controlData.controlId === controlId)
          if (idx >= 0) {
            chat.messages[idx] = {
              role: 'result',
              content: 'Generación de comentario cancelada.',
              _key: 'result-' + Date.now(),
            }
          }
        } else if (value.action === 'confirm') {
          await executeAmbientesDiffComment(controlId, controlMsg, value.message, value.modo_envio)
        }
        return
      } else if (stepType === 'resolution_set_default') {
        try {
          await fetch('/api/command/setting', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            credentials: 'include',
            body: JSON.stringify({ key: 'default_resolution', value }),
          })
          const idx = chat.messages.findIndex((m) => m.controlData && m.controlData.controlId === controlId)
          if (idx >= 0) {
            chat.messages[idx] = {
              role: 'result',
              content: `✓ Resolución por defecto establecida: "${value}"`,
              _key: 'result-' + Date.now(),
            }
          }
        } catch (err) {
          console.error('Error al guardar resolución por defecto:', err.message)
          const idx = chat.messages.findIndex((m) => m.controlData && m.controlData.controlId === controlId)
          if (idx >= 0) {
            chat.messages[idx] = {
              role: 'result',
              content: 'Error al guardar la resolución por defecto.',
              _key: 'err-' + Date.now(),
            }
          }
        }
        return
      } else if (controlType === 'funcionalidad_list') {
        modal.open(FuncionalidadWizard, {
          sessionId: value.sessionId,
          proyectoId: value.proyectoId,
        }, { title: 'Editar funcionalidad', wide: true })
        return
      } else if (controlType === 'ticket_edit') {
        if (value === null) {
          const idx = chat.messages.findIndex((m) => m.controlData && m.controlData.controlId === controlId)
          if (idx >= 0) {
            chat.messages[idx] = {
              role: 'result',
              content: 'Edición cancelada.',
              _key: 'result-' + Date.now(),
            }
          }
          return
        }
        try {
          const res = await fetch(`/api/tickets/session/${chat.activeSessionId}`, {
            method: 'PUT',
            headers: { 'Content-Type': 'application/json' },
            credentials: 'include',
            body: JSON.stringify(value),
          })
          const data = await res.json()
          if (data.success) {
            ticketInfo.value = data.ticket
            const idx = chat.messages.findIndex((m) => m.controlData && m.controlData.controlId === controlId)
            if (idx >= 0) {
              chat.messages[idx] = {
                role: 'result',
                content: `✓ Ticket #${data.ticket.redmine_id} actualizado correctamente.`,
                _key: 'result-' + Date.now(),
              }
            }
          } else {
            const idx = chat.messages.findIndex((m) => m.controlData && m.controlData.controlId === controlId)
            if (idx >= 0) {
              chat.messages[idx] = {
                role: 'result',
                content: `Error: ${data.error || 'Error al actualizar ticket'}`,
                _key: 'err-' + Date.now(),
              }
            }
          }
        } catch (err) {
          console.error('Error al actualizar ticket:', err)
          const idx = chat.messages.findIndex((m) => m.controlData && m.controlData.controlId === controlId)
          if (idx >= 0) {
            chat.messages[idx] = {
              role: 'result',
              content: 'Error de conexión al actualizar el ticket.',
              _key: 'err-' + Date.now(),
            }
          }
        }
        return
      } else if (controlType === 'ticket_create') {
        if (value === null) {
          const idx = chat.messages.findIndex((m) => m.controlData && m.controlData.controlId === controlId)
          if (idx >= 0) {
            chat.messages[idx] = {
              role: 'result',
              content: 'Creación cancelada.',
              _key: 'result-' + Date.now(),
            }
          }
          return
        }
        try {
          const res = await fetch(`/api/tickets/create`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            credentials: 'include',
            body: JSON.stringify(value),
          })
          const data = await res.json()
          if (data.success) {
            const idx = chat.messages.findIndex((m) => m.controlData && m.controlData.controlId === controlId)
            if (idx >= 0) {
              chat.messages[idx] = {
                role: 'result',
                content: `✓ Ticket #${data.ticket.redmine_id} creado correctamente en el proyecto "${data.ticket.proyecto_id}".`,
                _key: 'result-' + Date.now(),
              }
            }
          } else {
            const idx = chat.messages.findIndex((m) => m.controlData && m.controlData.controlId === controlId)
            if (idx >= 0) {
              chat.messages[idx] = {
                role: 'result',
                content: `Error: ${data.error || 'Error al crear ticket'}`,
                _key: 'err-' + Date.now(),
              }
            }
          }
        } catch (err) {
          console.error('Error al crear ticket:', err)
          const idx = chat.messages.findIndex((m) => m.controlData && m.controlData.controlId === controlId)
          if (idx >= 0) {
            chat.messages[idx] = {
              role: 'result',
              content: 'Error de conexión al crear el ticket.',
              _key: 'err-' + Date.now(),
            }
          }
        }
        return
      } else if (controlType === 'redmine_comments_send') {
        if (value === null) {
          const idx = chat.messages.findIndex((m) => m.controlData && m.controlData.controlId === controlId)
          if (idx >= 0) {
            chat.messages[idx] = {
              role: 'result',
              content: 'Envío de comentarios cancelado.',
              _key: 'result-' + Date.now(),
            }
          }
          return
        }
        try {
          const res = await fetch('/api/redmine/comments/send', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            credentials: 'include',
            body: JSON.stringify({
              comentarios_ids: value.comentarios_ids,
              mensaje: value.mensaje,
            }),
          })
          const data = await res.json()
          const idx = chat.messages.findIndex((m) => m.controlData && m.controlData.controlId === controlId)
          if (idx >= 0) {
            if (data.success) {
              chat.messages[idx] = {
                role: 'result',
                content: `✓ ${data.cantidad} comentario${data.cantidad !== 1 ? 's' : ''} enviado${data.cantidad !== 1 ? 's' : ''} al ticket #${data.ticket_id} correctamente.`,
                _key: 'result-' + Date.now(),
              }
            } else {
              chat.messages[idx] = {
                role: 'result',
                content: 'Error: ' + (data.error || 'Error al enviar comentarios'),
                _key: 'err-' + Date.now(),
              }
            }
          }
        } catch (err) {
          console.error('Error al enviar comentarios Redmine:', err.message)
          const idx = chat.messages.findIndex((m) => m.controlData && m.controlData.controlId === controlId)
          if (idx >= 0) {
            chat.messages[idx] = {
              role: 'result',
              content: 'Error de conexión al enviar comentarios.',
              _key: 'err-' + Date.now(),
            }
          }
        }
        return
      } else if (controlType === 'followup') {
        let { model, thinking, temperature, prompt } = value
        if (!prompt) return
        prompt = await resolveInput(prompt)
        ocStore.selectedModel = model || ocStore.selectedModel
        ocStore.selectedThinking = thinking || ocStore.selectedThinking
        ocStore.selectedTemperature = temperature || ocStore.selectedTemperature
        await opencodeStreamPrompt(
          chat.activeSessionId,
          prompt,
          ocStore.selectedProvider,
          ocStore.selectedModel,
          ocStore.selectedThinking,
          ocStore.selectedMode,
          ocStore.selectedTemperature,
        )
      } else if (controlType === 'opencode_form') {
        let { model, thinking, mode, temperature, prompt } = value
        if (!prompt) return
        prompt = await resolveInput(prompt)
        ocStore.selectedModel = model || ocStore.selectedModel
        ocStore.selectedThinking = thinking || ocStore.selectedThinking
        ocStore.selectedMode = mode || ocStore.selectedMode
        ocStore.selectedTemperature = temperature || ocStore.selectedTemperature
        await opencodeStreamPrompt(
          chat.activeSessionId,
          prompt,
          ocStore.selectedProvider,
          ocStore.selectedModel,
          ocStore.selectedThinking,
          ocStore.selectedMode,
          ocStore.selectedTemperature,
        )
      } else {
        // Runtime OpenCode control
        try {
          await fetch('/api/opencode/control', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            credentials: 'include',
            body: JSON.stringify({ controlId, response: value }),
          })
        } catch (err) {
          console.error('Error en control confirm:', err)
        }
      }

      // Replace control message with confirmed value
      const idx = chat.messages.findIndex((m) => m.controlData && m.controlData.controlId === controlId)
      if (idx >= 0) {
        chat.messages[idx] = {
          role: 'opencode_confirmed',
          content: typeof value === 'object' ? JSON.stringify(value) : String(value),
          _key: 'confirmed-' + Date.now(),
        }
      }
    }

    let ocSetupData = { provider: '', model: '', thinking: '', mode: '', prompt: '' }
    let commitSetupData = { provider: '', model: '', thinking: '', mode: '', temperature: '' }
    let commitData = { prompt: '', provider: '', model: '', thinking: '', mode: '', temperature: '' }
    let testingNotesSetupData = { provider: '', model: '', thinking: '', mode: 'Plan', temperature: '' }
    let testingNotesData = { prompt: '', provider: '', model: '', thinking: '', mode: '', temperature: '', origen: '', destino: '' }
    let docUpdateData = { provider: '', model: '', thinking: '', mode: '', temperature: '' }
    let descripcionData = { provider: '', model: '', thinking: '', mode: 'Plan', temperature: '' }
    const descripcionUserInput = ref('')
    let repoCrearRamaData = { proyectoId: '', ticketRedmineId: '', baseBranch: '', repoAcronimo: '' }

    async function handleDocumentacionUpdate(controlId, value, controlMsg) {
      const subStepType = controlMsg.controlData.subStepType

      if (subStepType === 'provider') {
        docUpdateData.provider = value
        docUpdateProyectoId.value = controlMsg.controlData.proyectoId || ''
        docUpdateType.value = controlMsg.controlData.docType || ''
        await ocStore.select('provider', value)
        ocStore.selectedProvider = value
        const models = ocStore.getModelsForProvider(value)
        chat.pushMessage({
          role: 'opencode_control',
          controlData: {
            controlId: 'model-' + Date.now(),
            controlType: 'select',
            stepType: 'documentacion_update',
            subStepType: 'model',
            options: models,
            placeholder: 'Selecciona modelo...',
            preselect: ocStore.savedModel || '',
          },
          _key: 'control-' + Date.now(),
        })
      } else if (subStepType === 'model') {
        docUpdateData.model = value
        await ocStore.select('model', value)
        ocStore.selectedModel = value
        if (ocStore.modelSupportsReasoning(docUpdateData.provider, value)) {
          chat.pushMessage({
            role: 'opencode_control',
            controlData: {
              controlId: 'thinking-' + Date.now(),
              controlType: 'select',
              stepType: 'documentacion_update',
              subStepType: 'thinking',
              options: ocStore.thinkingOptions,
              placeholder: 'Selecciona nivel de pensamiento...',
              preselect: ocStore.savedThinking || 'medium',
            },
            _key: 'control-' + Date.now(),
          })
        } else {
          const fakeMsg = { controlData: { subStepType: 'thinking' } }
          await handleDocumentacionUpdate(null, null, fakeMsg)
        }
      } else if (subStepType === 'thinking') {
        docUpdateData.thinking = value
        await ocStore.select('thinking', value)
        ocStore.selectedThinking = value
        // Skip mode selection — always use Plan
        const fakeMsg = { controlData: { subStepType: 'mode' } }
        await handleDocumentacionUpdate(null, null, fakeMsg)
      } else if (subStepType === 'mode') {
        // Always use Plan mode for documentation updates
        docUpdateData.mode = 'Plan'
        await ocStore.select('mode', 'Plan')
        ocStore.selectedMode = 'Plan'

        try {
          const tipos = docUpdateType.value === 'all'
            ? ['base_datos', 'subproyectos', 'endpoints', 'web_sockets', 'funcionalidades']
            : [docUpdateType.value]
          const settingsRes = await fetch('/api/settings', { credentials: 'include' })
          const settingsKeys = await settingsRes.json()

          for (const tipo of tipos) {
            const promptKey = 'documentacion_prompt_' + tipo
            const defaultPrompt = 'Analiza el proyecto actual y documenta la información correspondiente a ' + (DOC_LABELS[tipo] || tipo) + '. Proporciona una descripción detallada que permita a otros agentes de IA entender su propósito y alcance.'
            const prompt = settingsKeys[promptKey] || defaultPrompt

            chat.pushMessage({
              role: 'opencode_info',
              content: '📋 Prompt a enviar a OpenCode:\n\n```\n' + prompt + '\n```',
              _key: 'preview-' + Date.now(),
            })

            await opencodeStreamPromptDocUpdate(
              chat.activeSessionId,
              prompt,
              docUpdateData.provider,
              docUpdateData.model,
              docUpdateData.thinking,
              docUpdateData.mode,
              docUpdateData.temperature || ocStore.selectedTemperature || '',
              docUpdateProyectoId.value,
              tipo,
            )
          }

          if (docUpdateType.value === 'all') {
            chat.pushMessage({
              role: 'result',
              content: 'Documentación completada para todos los tipos.',
              _key: 'result-' + Date.now(),
            })
          }
        } catch (err) {
          console.error('Error al obtener prompt de documentación:', err.message)
          chat.pushMessage({
            role: 'result',
            content: 'Error al obtener prompt de documentación: ' + err.message,
            _key: 'result-' + Date.now(),
          })
        }
      }
    }

    async function handleTicketDescripcion(controlId, value, controlMsg) {
      const subStepType = controlMsg.controlData.subStepType

      if (subStepType === 'provider') {
        descripcionData.provider = value
        await ocStore.select('provider', value)
        ocStore.selectedProvider = value
        const models = ocStore.getModelsForProvider(value)
        chat.pushMessage({
          role: 'opencode_control',
          controlData: {
            controlId: 'model-' + Date.now(),
            controlType: 'select',
            stepType: 'ticket_descripcion',
            subStepType: 'model',
            options: models,
            placeholder: 'Selecciona modelo...',
            preselect: ocStore.savedModel || '',
            ticket: controlMsg.controlData.ticket,
            sessionId: controlMsg.controlData.sessionId,
          },
          _key: 'control-' + Date.now(),
        })
      } else if (subStepType === 'model') {
        descripcionData.model = value
        await ocStore.select('model', value)
        ocStore.selectedModel = value
        if (ocStore.modelSupportsReasoning(descripcionData.provider, value)) {
          chat.pushMessage({
            role: 'opencode_control',
            controlData: {
              controlId: 'thinking-' + Date.now(),
              controlType: 'select',
              stepType: 'ticket_descripcion',
              subStepType: 'thinking',
              options: ocStore.thinkingOptions,
              placeholder: 'Selecciona nivel de pensamiento...',
              preselect: ocStore.savedThinking || 'medium',
              ticket: controlMsg.controlData.ticket,
              sessionId: controlMsg.controlData.sessionId,
            },
            _key: 'control-' + Date.now(),
          })
        } else {
          const fakeMsg = { controlData: { subStepType: 'thinking', ticket: controlMsg.controlData.ticket, sessionId: controlMsg.controlData.sessionId } }
          await handleTicketDescripcion(null, null, fakeMsg)
        }
      } else if (subStepType === 'thinking') {
        descripcionData.thinking = value
        await ocStore.select('thinking', value)
        ocStore.selectedThinking = value
        chat.pushMessage({
          role: 'opencode_control',
          controlData: {
            controlId: 'descripcion-input-' + Date.now(),
            controlType: 'descripcion_input',
            stepType: 'ticket_descripcion',
            subStepType: 'descripcion_input',
            placeholder: 'Ej: Describe el error y los pasos para reproducirlo...',
            ticket: controlMsg.controlData.ticket,
            sessionId: controlMsg.controlData.sessionId,
          },
          _key: 'control-' + Date.now(),
        })
      } else if (subStepType === 'descripcion_input') {
        descripcionUserInput.value = value.text
        const ticket = controlMsg.controlData.ticket

        try {
          const settingsRes = await fetch('/api/settings', { credentials: 'include' })
          const settingsKeys = await settingsRes.json()
          const defaultPrompt = 'Eres un asistente experto en redactar descripciones técnicas para tickets de Redmine. Tu objetivo principal es generar una descripción ÓPTIMA y detallada para el siguiente ticket:\n\nContexto del ticket:\n- Título: {subject}\n- Estado actual: {status}\n- Prioridad: {priority}\n- Asignado a: {assigned_to}\n\nInstrucciones:\n1. Genera una descripción clara, precisa y bien estructurada que explique el problema o requerimiento del ticket.\n2. Utiliza la siguiente solicitud del usuario como guía para el contenido:\n{user_input}\n3. La descripción debe ser profesional, técnica y útil para desarrolladores.\n4. Incluye solo información relevante al ticket, sin divagaciones.'
          const promptTemplate = settingsKeys.ticket_descripcion_prompt || defaultPrompt
          const prompt = promptTemplate
            .replace(/{subject}/g, ticket.subject || '')
            .replace(/{status}/g, ticket.status_name || '')
            .replace(/{priority}/g, ticket.priority_name || '')
            .replace(/{assigned_to}/g, ticket.assigned_to_name || '')
            .replace(/{user_input}/g, descripcionUserInput.value)

          chat.pushMessage({
            role: 'opencode_info',
            content: '📤 Prompt enviado a OpenCode:\n\n' + prompt,
            _key: 'prompt-' + Date.now(),
          })

          await opencodeStreamDescripcion(
            chat.activeSessionId,
            prompt,
            descripcionData.provider,
            descripcionData.model,
            descripcionData.thinking,
            descripcionData.mode,
            descripcionData.temperature || ocStore.selectedTemperature || '',
            ticket,
          )
        } catch (err) {
          console.error('Error al obtener prompt de descripción:', err.message)
          chat.pushMessage({
            role: 'result',
            content: 'Error al obtener prompt de descripción: ' + err.message,
            _key: 'err-' + Date.now(),
          })
        }
      }
    }

    async function handleRepoCrearRama(controlId, value, controlMsg) {
      const subStepType = controlMsg.controlData.subStepType

      if (subStepType === 'project') {
        repoCrearRamaData.proyectoId = value
        repoCrearRamaData.repoAcronimo = controlMsg.controlData.repoAcronimo || 'TKT'

        try {
          const res = await fetch('/api/proyecto/session', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            credentials: 'include',
            body: JSON.stringify({ sessionId: chat.activeSessionId, proyectoId: value, cwd: '' }),
          })
          const data = await res.json()
          if (!data.success) {
            console.error('Error al asignar proyecto:', data.error)
          }
        } catch (err) {
          console.error('Error al asignar proyecto:', err.message)
        }

        const idx = chat.messages.findIndex(m => m.controlData && m.controlData.controlId === controlId)
        if (idx >= 0) {
          chat.messages[idx] = { role: 'opencode_confirmed', content: value, _key: 'confirmed-' + Date.now() }
        }

        await chat.loadSessions()
        const updatedSession = chat.sessions.find(s => s.id === chat.activeSessionId)

        if (updatedSession && updatedSession.id_ticket_redmine) {
          repoCrearRamaData.ticketRedmineId = updatedSession.id_ticket_redmine
          await showBranchSelector(controlMsg.controlData.sessionId, repoCrearRamaData.repoAcronimo, updatedSession.proyecto_id, updatedSession.id_ticket_redmine)
        } else {
          const ticketRes = await fetch('/api/tickets', { credentials: 'include' })
          const ticketData = await ticketRes.json()
          let tickets = ticketData.tickets || []
          if (value) {
            tickets = tickets.filter(t => t.proyecto_id === value)
          }
          const options = tickets.map(t => ({
            label: `#${t.redmine_id} — ${t.subject || ''}`,
            value: String(t.redmine_id),
          }))
          chat.pushMessage({
            role: 'opencode_control',
            controlData: {
              controlId: 'repo-ticket-' + Date.now(),
              controlType: 'select',
              stepType: 'repo_crear_rama',
              subStepType: 'ticket',
              options,
              placeholder: 'Selecciona ticket...',
              proyectoId: value,
              sessionId: controlMsg.controlData.sessionId,
              repoAcronimo: repoCrearRamaData.repoAcronimo,
            },
            _key: 'control-' + Date.now(),
          })
        }
      } else if (subStepType === 'ticket') {
        repoCrearRamaData.ticketRedmineId = value
        repoCrearRamaData.proyectoId = controlMsg.controlData.proyectoId || ''
        repoCrearRamaData.repoAcronimo = controlMsg.controlData.repoAcronimo || 'TKT'

        try {
          const res = await fetch('/api/tickets/session', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            credentials: 'include',
            body: JSON.stringify({ sessionId: chat.activeSessionId, idTicketRedmine: parseInt(value) }),
          })
          const data = await res.json()
          if (!data.success) {
            console.error('Error al asignar ticket:', data.error)
          }
        } catch (err) {
          console.error('Error al asignar ticket:', err.message)
        }

        const idx = chat.messages.findIndex(m => m.controlData && m.controlData.controlId === controlId)
        if (idx >= 0) {
          chat.messages[idx] = { role: 'opencode_confirmed', content: '#' + value, _key: 'confirmed-' + Date.now() }
        }

        await chat.loadSessions()
        const updatedSession = chat.sessions.find(s => s.id === chat.activeSessionId)

        await showBranchSelector(controlMsg.controlData.sessionId, repoCrearRamaData.repoAcronimo, repoCrearRamaData.proyectoId || updatedSession?.proyecto_id, parseInt(value))
      } else if (subStepType === 'branch') {
        repoCrearRamaData.baseBranch = value
        const proyectoId = controlMsg.controlData.proyectoId || repoCrearRamaData.proyectoId
        const ticketRedmineId = controlMsg.controlData.ticketRedmineId || repoCrearRamaData.ticketRedmineId
        const repoAcronimo = controlMsg.controlData.repoAcronimo || repoCrearRamaData.repoAcronimo || 'TKT'
        const sessionId = controlMsg.controlData.sessionId || chat.activeSessionId
        const branchName = repoAcronimo + '-' + ticketRedmineId

        try {
          const checkoutRes = await fetch('/api/command/git', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            credentials: 'include',
            body: JSON.stringify({ command: 'checkout ' + value, sessionId }),
          })
          const checkoutData = await checkoutRes.json()

          if (!checkoutData.success) {
            const idx = chat.messages.findIndex(m => m.controlData && m.controlData.controlId === controlId)
            if (idx >= 0) {
              chat.messages[idx] = {
                role: 'result',
                content: 'Error al cambiar a rama base "' + value + '": ' + (checkoutData.stderr || checkoutData.error || 'Error desconocido'),
                _key: 'err-' + Date.now(),
              }
            }
            return
          }

          const branchRes = await fetch('/api/command/git', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            credentials: 'include',
            body: JSON.stringify({ command: 'checkout -b ' + branchName, sessionId }),
          })
          const branchData = await branchRes.json()

          const idx = chat.messages.findIndex(m => m.controlData && m.controlData.controlId === controlId)
          if (idx >= 0) {
            if (branchData.success) {
              chat.messages[idx] = {
                role: 'result',
                content: 'Rama creada correctamente: `' + branchName + '` (base: `' + value + '`)',
                _key: 'result-' + Date.now(),
              }
            } else {
              chat.messages[idx] = {
                role: 'result',
                content: 'Error al crear rama "' + branchName + '": ' + (branchData.stderr || branchData.error || 'Error desconocido'),
                _key: 'err-' + Date.now(),
              }
            }
          }
        } catch (err) {
          console.error('Error en repo:crear_rama:', err.message)
          const idx = chat.messages.findIndex(m => m.controlData && m.controlData.controlId === controlId)
          if (idx >= 0) {
            chat.messages[idx] = {
              role: 'result',
              content: 'Error de conexión: ' + err.message,
              _key: 'err-' + Date.now(),
            }
          }
        }
      }
      fetchGitBranch()
    }

    async function showBranchSelector(sessionId, repoAcronimo, proyectoId, ticketRedmineId) {
      try {
        const branchRes = await fetch('/api/command/git-list-branches', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          credentials: 'include',
          body: JSON.stringify({ sessionId }),
        })
        const branchData = await branchRes.json()
        const branchOptions = (branchData.branches || []).map(b => ({ label: b, value: b }))
        const preselect = branchData.current && branchData.branches.includes(branchData.current) ? branchData.current : 'DEV'

        chat.pushMessage({
          role: 'opencode_control',
          controlData: {
            controlId: 'repo-branch-' + Date.now(),
            controlType: 'select',
            stepType: 'repo_crear_rama',
            subStepType: 'branch',
            options: branchOptions,
            placeholder: 'Selecciona rama base...',
            preselect,
            proyectoId,
            ticketRedmineId,
            sessionId,
            repoAcronimo,
          },
          _key: 'control-' + Date.now(),
        })
      } catch (err) {
        console.error('Error al obtener ramas:', err.message)
        chat.pushMessage({
          role: 'result',
          content: 'Error al listar ramas Git: ' + err.message,
          _key: 'err-' + Date.now(),
        })
      }
    }

    async function opencodeStreamDescripcion(sessionId, prompt, provider, model, thinking, mode, temperature, ticket) {
      ocStreaming.value = true
      ocChunk.value = ''
      ocThinking.value = ''
      _streamSessionId.value = sessionId
      if (sessionId) chat.setSessionStatus(sessionId, 'executing')

      const streamMsg = await addMessage('opencode_stream', '', { streaming: true })
      streamMsg._key = 'stream-' + Date.now()

      await ocStore.streamPrompt(sessionId, prompt, provider, model, thinking, mode, temperature, {
        onChunk(content) {
          if (_isActiveSession(sessionId)) {
            ocChunk.value += content
            const idx = chat.messages.findIndex((m) => m._key === streamMsg._key)
            if (idx >= 0) chat.messages[idx].content = ocChunk.value
          }
        },
        onThinking(content) {
          if (_isActiveSession(sessionId)) {
            ocThinking.value += content
            const idx = chat.messages.findIndex((m) => m._key === streamMsg._key)
            if (idx >= 0) chat.messages[idx].thinking = ocThinking.value
          }
        },
        onControl(control) {
          const controlMsg = {
            role: 'opencode_control',
            content: JSON.stringify(control),
            controlData: control,
            _key: 'control-' + Date.now(),
          }
          chat._saveMessageToDb(sessionId, controlMsg)
          if (_isActiveSession(sessionId)) {
            chat.pushMessage(controlMsg)
          } else {
            chat.pendingNotifications[sessionId] = Date.now()
          }
        },
        onDone(json, fullText) {
          ocStreaming.value = false
          if (sessionId) chat.setSessionStatus(sessionId, 'idle')
          const fullResponse = json.fullResponse || fullText || '(sin respuesta)'
          const thinking = json.thinking || ocThinking.value || null
          chat._saveMessageToDb(sessionId, { role: 'opencode_result', content: fullResponse, thinking })
          if (_isActiveSession(sessionId)) {
            const idx = chat.messages.findIndex((m) => m._key === streamMsg._key)
            if (idx >= 0) {
              chat.messages[idx].streaming = false
              chat.messages[idx].role = 'opencode_result'
              chat.messages[idx].content = fullResponse
              chat.messages[idx].thinking = thinking
            }
            chat.pushMessage({
              role: 'opencode_control',
              controlData: {
                controlId: 'descripcion-result-' + Date.now(),
                controlType: 'descripcion_result',
                description: fullResponse,
                loading: false,
                ticket,
              },
              _key: 'control-' + Date.now(),
            })
            chat.pushMessage({
              role: 'opencode_control',
              controlData: {
                controlId: 'followup-' + Date.now(),
                controlType: 'opencode_form',
                stepType: 'ticket_descripcion',
                ticket,
                models: ocStore.getModelsForProvider(ocStore.selectedProvider),
                modelValue: ocStore.selectedModel || '',
                thinkingOptions: ocStore.thinkingOptions,
                thinkingValue: ocStore.selectedThinking || '',
                modeValue: ocStore.selectedMode || 'Plan',
                placeholder: 'Escribe otro mensaje para OpenCode...',
                rows: 3,
              },
              _key: 'control-' + Date.now(),
            })
          } else {
            chat.pendingNotifications[sessionId] = Date.now()
          }
        },
        onError(msg) {
          ocStreaming.value = false
          if (sessionId) chat.setSessionStatus(sessionId, 'error')
          chat._saveMessageToDb(sessionId, { role: 'opencode_result', content: `[Error: ${msg}]` })
          if (_isActiveSession(sessionId)) {
            const idx = chat.messages.findIndex((m) => m._key === streamMsg._key)
            if (idx >= 0) {
              chat.messages[idx].content = '[Error: ' + msg + ']'
              chat.messages[idx].streaming = false
            }
          } else {
            chat.pendingNotifications[sessionId] = Date.now()
          }
        },
      })
    }

    async function opencodeStreamDescripcionFollowup(sessionId, userPrompt, ticket, temperature) {
      ocStreaming.value = true
      ocChunk.value = ''
      ocThinking.value = ''
      _streamSessionId.value = sessionId
      if (sessionId) chat.setSessionStatus(sessionId, 'executing')

      if (_isActiveSession(sessionId)) {
        chat.pushMessage({
          role: 'user',
          content: userPrompt,
          _key: 'user-' + Date.now(),
        })

        chat.pushMessage({
          role: 'opencode_info',
          content: '📤 Mensaje enviado a OpenCode:\n\n' + userPrompt,
          _key: 'prompt-' + Date.now(),
        })
      }

      const streamMsg = await addMessage('opencode_stream', '', { streaming: true })
      streamMsg._key = 'stream-' + Date.now()

      await ocStore.streamPrompt(sessionId, userPrompt, descripcionData.provider, ocStore.selectedModel || descripcionData.model, ocStore.selectedThinking || descripcionData.thinking, ocStore.selectedMode || descripcionData.mode, temperature, {
        onChunk(content) {
          if (_isActiveSession(sessionId)) {
            ocChunk.value += content
            const idx = chat.messages.findIndex((m) => m._key === streamMsg._key)
            if (idx >= 0) chat.messages[idx].content = ocChunk.value
          }
        },
        onThinking(content) {
          if (_isActiveSession(sessionId)) {
            ocThinking.value += content
            const idx = chat.messages.findIndex((m) => m._key === streamMsg._key)
            if (idx >= 0) chat.messages[idx].thinking = ocThinking.value
          }
        },
        onControl(control) {
          const controlMsg = {
            role: 'opencode_control',
            content: JSON.stringify(control),
            controlData: control,
            _key: 'control-' + Date.now(),
          }
          chat._saveMessageToDb(sessionId, controlMsg)
          if (_isActiveSession(sessionId)) {
            chat.pushMessage(controlMsg)
          } else {
            chat.pendingNotifications[sessionId] = Date.now()
          }
        },
        onDone(json, fullText) {
          ocStreaming.value = false
          if (sessionId) chat.setSessionStatus(sessionId, 'idle')
          const fullResponse = json.fullResponse || fullText || '(sin respuesta)'
          const thinking = json.thinking || ocThinking.value || null
          chat._saveMessageToDb(sessionId, { role: 'opencode_result', content: fullResponse, thinking })
          if (_isActiveSession(sessionId)) {
            // Demote the previous descripcion_result to a plain result (no buttons)
            for (let i = chat.messages.length - 1; i >= 0; i--) {
              const m = chat.messages[i]
              if (m.controlData && m.controlData.controlType === 'descripcion_result') {
                chat.messages[i] = {
                  role: 'result',
                  content: m.controlData.description || '(descripción anterior)',
                  _key: 'old-result-' + Date.now(),
                }
                break
              }
            }
            // Replace stream message with the NEW descripcion_result (with buttons)
            const streamIdx = chat.messages.findIndex((m) => m._key === streamMsg._key)
            if (streamIdx >= 0) {
              chat.messages[streamIdx] = {
                role: 'opencode_control',
                controlData: {
                  controlId: 'descripcion-result-' + Date.now(),
                  controlType: 'descripcion_result',
                  description: fullResponse,
                  loading: false,
                  ticket,
                },
                _key: 'control-' + Date.now(),
              }
            }
            // Add new followup control to continue the conversation
            chat.pushMessage({
              role: 'opencode_control',
              controlData: {
                controlId: 'followup-' + Date.now(),
                controlType: 'opencode_form',
                stepType: 'ticket_descripcion',
                ticket,
                models: ocStore.getModelsForProvider(ocStore.selectedProvider),
                modelValue: ocStore.selectedModel || '',
                thinkingOptions: ocStore.thinkingOptions,
                thinkingValue: ocStore.selectedThinking || '',
                modeValue: ocStore.selectedMode || 'Plan',
                placeholder: 'Escribe otro mensaje para OpenCode...',
                rows: 3,
              },
              _key: 'control-' + Date.now(),
            })
          } else {
            chat.pendingNotifications[sessionId] = Date.now()
          }
        },
        onError(msg) {
          ocStreaming.value = false
          if (sessionId) chat.setSessionStatus(sessionId, 'error')
          chat._saveMessageToDb(sessionId, { role: 'opencode_result', content: `[Error: ${msg}]` })
          if (_isActiveSession(sessionId)) {
            const streamIdx = chat.messages.findIndex((m) => m._key === streamMsg._key)
            if (streamIdx >= 0) {
              chat.messages[streamIdx].content = '[Error: ' + msg + ']'
              chat.messages[streamIdx].streaming = false
            }
          } else {
            chat.pendingNotifications[sessionId] = Date.now()
          }
        },
      })
    }

    async function refinarDescripcionConDeepSeek(controlId, controlMsg, description) {
      ocStreaming.value = true
      ocChunk.value = ''
      ocThinking.value = ''
      const sid = chat.activeSessionId
      if (sid) chat.setSessionStatus(sid, 'executing')
      _streamSessionId.value = sid

      const streamMsg = await addMessage('opencode_stream', '', { streaming: true })
      streamMsg._key = 'stream-' + Date.now()

      try {
        const settingsRes = await fetch('/api/settings', { credentials: 'include' })
        const settingsKeys = await settingsRes.json()
        const systemPrompt = settingsKeys.ticket_refinar_prompt || 'Eres un asistente especializado en refinar descripciones técnicas. Mejora la redacción, estructura y claridad del texto. Devuelve únicamente la descripción refinada.'

        const res = await fetch('/api/chat/refine', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          credentials: 'include',
          body: JSON.stringify({ text: description, systemPrompt, sessionId: sid }),
        })

        if (!res.ok) {
          let errMsg = 'Error al refinar descripción'
          try { const errData = await res.json(); if (errData.error) errMsg = errData.error } catch {}
          throw new Error(errMsg)
        }

        let fullResponse = ''
        const reader = res.body.getReader()
        const decoder = new TextDecoder()
        let buf = ''

        while (true) {
          const { done, value } = await reader.read()
          if (done) break
          buf += decoder.decode(value, { stream: true })
          const lines = buf.split('\n')
          buf = lines.pop() || ''
          for (const line of lines) {
            const t = line.trim()
            if (!t || !t.startsWith('data: ')) continue
            try {
              const j = JSON.parse(t.slice(6))
              if (j.type === 'response') {
                fullResponse += j.content
                if (_isActiveSession(sid)) ocChunk.value += j.content
              } else if (j.type === 'thinking') {
                if (_isActiveSession(sid)) ocThinking.value += j.content
              } else if (j.type === 'error') {
                throw new Error(j.content)
              }
            } catch (e) {
              if (e.message && e.message !== 'Unexpected end of JSON input') throw e
            }
          }
        }

        ocStreaming.value = false
        if (sid) chat.setSessionStatus(sid, 'idle')

        if (_isActiveSession(sid)) {
          const ticket = controlMsg?.controlData?.ticket || {}
          // Demote old descripcion_result to plain result
          const oldIdx = chat.messages.findIndex((m) => m.controlData && m.controlData.controlId === controlId)
          if (oldIdx >= 0) {
            chat.messages[oldIdx] = {
              role: 'result',
              content: '✓ Descripción aceptada, refinando...',
              _key: 'old-result-' + Date.now(),
            }
          }
          // Replace stream message with refinar_result (has accept/retry/cancel)
          const streamIdx = chat.messages.findIndex((m) => m._key === streamMsg._key)
          if (streamIdx >= 0) {
            chat.messages[streamIdx] = {
              role: 'opencode_control',
              controlData: {
                controlId: 'refinar-result-' + Date.now(),
                controlType: 'refinar_result',
                description: fullResponse,
                loading: false,
                ticket,
              },
              _key: 'control-' + Date.now(),
            }
          }
        }
      } catch (err) {
        console.error('Error al refinar descripción:', err.message)
        ocStreaming.value = false
        if (sid) chat.setSessionStatus(sid, 'error')
        const streamIdx = chat.messages.findIndex((m) => m._key === streamMsg._key)
        if (streamIdx >= 0 && _isActiveSession(sid)) {
          chat.messages[streamIdx].content = '[Error: ' + err.message + ']'
          chat.messages[streamIdx].streaming = false
        }
      }
    }

    async function restartTicketDescripcion() {
      const sid = chat.activeSessionId
      if (!sid) return

      try {
        const res = await fetch(`/api/tickets/session/${sid}`, { credentials: 'include' })
        const data = await res.json()
        if (!data.idTicketRedmine || !data.ticket) {
          chat.pushMessage({
            role: 'result',
            content: 'Error: No hay ticket asignado a esta sesión.',
            _key: 'err-' + Date.now(),
          })
          return
        }

        const ocStore = useOpencodeStore()
        const startData = await ocStore.start()
        if (!startData) {
          chat.pushMessage({
            role: 'result',
            content: 'Error al iniciar OpenCode.',
            _key: 'err-' + Date.now(),
          })
          return
        }

        const providerList = ocStore.getAvailableProviders()
        if (providerList.length === 0) {
          chat.pushMessage({
            role: 'result',
            content: 'No se encontraron proveedores de OpenCode.',
            _key: 'err-' + Date.now(),
          })
          return
        }

        const preselectProvider = ocStore.savedProvider || providerList[0].value
        chat.pushMessage({
          role: 'opencode_control',
          controlData: {
            controlId: 'provider-' + Date.now(),
            controlType: 'select',
            stepType: 'ticket_descripcion',
            subStepType: 'provider',
            options: providerList,
            placeholder: 'Selecciona proveedor...',
            preselect: preselectProvider,
            ticket: data.ticket,
            sessionId: sid,
          },
          _key: 'control-' + Date.now(),
        })
      } catch (err) {
        console.error('Error al reiniciar:', err.message)
        chat.pushMessage({
          role: 'result',
          content: 'Error al reiniciar el proceso: ' + err.message,
          _key: 'err-' + Date.now(),
        })
      }
    }

    async function regenerateDescripcion(controlId, controlMsg) {
      const oldIdx = chat.messages.findIndex((m) => m.controlData && m.controlData.controlId === controlId)
      if (oldIdx >= 0 && _isActiveSession(chat.activeSessionId)) {
        chat.messages[oldIdx].controlData.loading = true
      }

      const newStreamKey = 'stream-' + Date.now()
      const sid = chat.activeSessionId
      _streamSessionId.value = sid

      if (_isActiveSession(sid)) {
        chat.pushMessage({
          role: 'opencode_stream',
          content: '',
          streaming: true,
          _key: newStreamKey,
        })
      }

      const ticket = controlMsg?.controlData?.ticket || {}
      ocStore.selectedModel = ocStore.selectedModel || descripcionData.model
      ocStore.selectedThinking = ocStore.selectedThinking || descripcionData.thinking

      try {
        const settingsRes = await fetch('/api/settings', { credentials: 'include' })
        const settingsKeys = await settingsRes.json()
        const defaultPrompt = 'Eres un asistente experto en redactar descripciones técnicas para tickets de Redmine. Tu objetivo principal es generar una descripción ÓPTIMA y detallada para el siguiente ticket:\n\nContexto del ticket:\n- Título: {subject}\n- Estado actual: {status}\n- Prioridad: {priority}\n- Asignado a: {assigned_to}\n\nInstrucciones:\n1. Genera una descripción clara, precisa y bien estructurada que explique el problema o requerimiento del ticket.\n2. Utiliza la siguiente solicitud del usuario como guía para el contenido:\n{user_input}\n3. La descripción debe ser profesional, técnica y útil para desarrolladores.\n4. Incluye solo información relevante al ticket, sin divagaciones.'
        const promptTemplate = settingsKeys.ticket_descripcion_prompt || defaultPrompt
        const prompt = promptTemplate
          .replace(/{subject}/g, ticket.subject || '')
          .replace(/{status}/g, ticket.status_name || '')
          .replace(/{priority}/g, ticket.priority_name || '')
          .replace(/{assigned_to}/g, ticket.assigned_to_name || '')
          .replace(/{user_input}/g, descripcionUserInput.value)

        if (_isActiveSession(sid)) {
          chat.pushMessage({
            role: 'opencode_info',
            content: '📤 Prompt enviado a OpenCode:\n\n' + prompt,
            _key: 'prompt-' + Date.now(),
          })
        }

        ocStreaming.value = true
        ocChunk.value = ''
        ocThinking.value = ''
        if (sid) chat.setSessionStatus(sid, 'executing')

        await ocStore.streamPrompt(sid, prompt, descripcionData.provider, descripcionData.model, descripcionData.thinking, descripcionData.mode, descripcionData.temperature || ocStore.selectedTemperature || '', {
          onChunk(content) {
            if (_isActiveSession(sid)) ocChunk.value += content
          },
          onThinking(content) {
            if (_isActiveSession(sid)) ocThinking.value += content
          },
          onControl(control) {
            const controlMsg = {
              role: 'opencode_control',
              content: JSON.stringify(control),
              controlData: control,
              _key: 'control-' + Date.now(),
            }
            chat._saveMessageToDb(sid, controlMsg)
            if (_isActiveSession(sid)) {
              chat.pushMessage(controlMsg)
            } else {
              chat.pendingNotifications[sid] = Date.now()
            }
          },
          onDone(json, fullText) {
            ocStreaming.value = false
            if (sid) chat.setSessionStatus(sid, 'idle')
            const fullResponse = json.fullResponse || fullText || '(sin respuesta)'
            chat._saveMessageToDb(sid, { role: 'opencode_result', content: fullResponse })
            if (_isActiveSession(sid)) {
              const idx = chat.messages.findIndex((m) => m._key === newStreamKey)
              if (idx >= 0) {
                chat.messages[idx].role = 'opencode_result'
                chat.messages[idx].content = fullResponse
                chat.messages[idx].streaming = false
              }
              if (oldIdx >= 0) {
                chat.messages[oldIdx] = {
                  role: 'opencode_control',
                  controlData: {
                    controlId: 'descripcion-result-' + Date.now(),
                    controlType: 'descripcion_result',
                    description: fullResponse,
                    loading: false,
                    ticket,
                  },
                  _key: 'control-' + Date.now(),
                }
              }
            } else {
              chat.pendingNotifications[sid] = Date.now()
            }
          },
          onError(msg) {
            ocStreaming.value = false
            if (sid) chat.setSessionStatus(sid, 'error')
            chat._saveMessageToDb(sid, { role: 'opencode_result', content: `[Error: ${msg}]` })
            if (_isActiveSession(sid)) {
              const idx = chat.messages.findIndex((m) => m._key === newStreamKey)
              if (idx >= 0) {
                chat.messages[idx].content = '[Error: ' + msg + ']'
                chat.messages[idx].streaming = false
              }
              if (oldIdx >= 0) {
                chat.messages[oldIdx].controlData.loading = false
              }
            } else {
              chat.pendingNotifications[sid] = Date.now()
            }
          },
        })
      } catch (err) {
        console.error('Error al reintentar:', err.message)
        if (sid) chat.setSessionStatus(sid, 'error')
        if (oldIdx >= 0 && _isActiveSession(sid)) {
          chat.messages[oldIdx].controlData.loading = false
        }
      }
    }

    async function handleOpencodeSetup(controlId, value, controlMsg) {
      const subStepType = controlMsg.controlData.subStepType

      if (subStepType === 'provider') {
        ocSetupData.provider = value
        await ocStore.select('provider', value)
        ocStore.selectedProvider = value
        const models = ocStore.getModelsForProvider(value)
        const prefill = controlMsg.controlData.prefill || ''
        chat.pushMessage({
          role: 'opencode_control',
            controlData: {
              controlId: 'opencode-form-' + Date.now(),
              controlType: 'opencode_form',
              stepType: 'opencode_setup',
              subStepType: 'form',
              models,
              modelValue: ocStore.savedModel || '',
              thinkingOptions: ocStore.thinkingOptions,
              thinkingValue: ocStore.savedThinking || '',
              temperatureOptions: ocStore.temperatureOptions,
              temperatureValue: ocStore.savedTemperature || '0.7',
              modeValue: ocStore.savedMode || 'Build',
              placeholder: prefill ? 'Revisa la descripción del ticket y modifícala si es necesario antes de enviar...' : 'Describe qué quieres que OpenCode haga...',
              rows: prefill ? 8 : 5,
              prefill,
            },
            _key: 'control-' + Date.now(),
          })
        } else if (subStepType === 'form') {
          const { model, thinking, mode, temperature, prompt } = value
          ocSetupData.model = model
          ocSetupData.thinking = thinking
          ocSetupData.mode = mode
          ocSetupData.temperature = temperature
          ocSetupData.prompt = prompt
          await ocStore.select('model', model)
          await ocStore.select('thinking', thinking || '')
          await ocStore.select('mode', mode)
          if (temperature) await ocStore.select('temperature', temperature)
          ocStore.selectedModel = model
          ocStore.selectedThinking = thinking || ''
          ocStore.selectedMode = mode
          ocStore.selectedTemperature = temperature || ''

          const formIdx = chat.messages.findIndex((m) => m.controlData && m.controlData.controlId === controlId)
          if (formIdx >= 0) {
            chat.messages[formIdx] = {
              role: 'opencode_confirmed',
              content: typeof value === 'object' ? JSON.stringify(value) : String(value),
              _key: 'confirmed-' + Date.now(),
            }
          }

          await opencodeStreamPrompt(
            chat.activeSessionId,
            prompt,
            ocSetupData.provider,
            model,
            thinking,
            mode,
            temperature,
          )
      }
    }

    async function handleGenerarCommitSetup(controlId, value, controlMsg) {
      const subStepType = controlMsg.controlData.subStepType

      if (subStepType === 'provider') {
        commitSetupData.provider = value
        await ocStore.select('provider', value)
        ocStore.selectedProvider = value
        const models = ocStore.getModelsForProvider(value)
        chat.pushMessage({
          role: 'opencode_control',
          controlData: {
            controlId: 'gc-form-' + Date.now(),
            controlType: 'generar_commit_form',
            stepType: 'generar_commit_setup',
            subStepType: 'form',
            models,
            modelValue: ocStore.savedModel || '',
            thinkingOptions: ocStore.thinkingOptions,
            thinkingValue: ocStore.savedThinking || '',
            temperatureOptions: ocStore.temperatureOptions,
            temperatureValue: ocStore.savedTemperature || '0.7',
          },
          _key: 'control-' + Date.now(),
        })
      } else if (subStepType === 'form') {
        const { model, thinking = '', mode = 'Plan', temperature = '0.7' } = value || {}
        commitSetupData.model = model
        commitSetupData.thinking = thinking
        commitSetupData.mode = mode
        commitSetupData.temperature = temperature
        await ocStore.select('model', model)
        await ocStore.select('thinking', thinking || '')
        await ocStore.select('mode', mode)
        if (temperature) await ocStore.select('temperature', temperature)
        ocStore.selectedModel = model
        ocStore.selectedThinking = thinking || ''
        ocStore.selectedMode = mode
        ocStore.selectedTemperature = temperature || ''

        let prompt
        try {
          const tmplRes = await fetch('/api/templates/commit-prompt', { credentials: 'include' })
          if (tmplRes.ok) {
            const tmplData = await tmplRes.json()
            prompt = tmplData.content
          } else {
            prompt = 'Analizá los cambios realizados en el proyecto actual (revisando el diff de Git) y generá un mensaje de commit descriptivo. El mensaje debe ser conciso (máximo 300 caracteres) y reflejar claramente las modificaciones aplicadas al código. Debes comenzar en modo planificación mostrando primero la propuesta de commit. IMPORTANTE: Devuelve ÚNICAMENTE el mensaje de commit, sin explicaciones, análisis ni ningún otro texto adicional.'
          }
        } catch (err) {
          console.error('Error al cargar plantilla commit-prompt:', err)
          prompt = 'Analizá los cambios realizados en el proyecto actual (revisando el diff de Git) y generá un mensaje de commit descriptivo. El mensaje debe ser conciso (máximo 300 caracteres) y reflejar claramente las modificaciones aplicadas al código. Debes comenzar en modo planificación mostrando primero la propuesta de commit. IMPORTANTE: Devuelve ÚNICAMENTE el mensaje de commit, sin explicaciones, análisis ni ningún otro texto adicional.'
        }

        commitData.prompt = prompt
        commitData.provider = commitSetupData.provider
        commitData.model = model
        commitData.thinking = thinking
        commitData.mode = mode
        commitData.temperature = temperature

        await opencodeStreamPromptCommit(
          chat.activeSessionId,
          prompt,
          commitSetupData.provider,
          model,
          thinking,
          mode,
          temperature,
        )
      }
    }

    async function handleAmbientesDiffTestingSetup(controlId, value, controlMsg) {
      const subStepType = controlMsg.controlData.subStepType

      if (subStepType === 'provider') {
        testingNotesSetupData.provider = value
        testingNotesData.origen = controlMsg.controlData.origen || ''
        testingNotesData.destino = controlMsg.controlData.destino || ''
        testingNotesData.diffData = controlMsg.controlData.diffData || null
        await ocStore.select('provider', value)
        ocStore.selectedProvider = value
        const models = ocStore.getModelsForProvider(value)
        chat.pushMessage({
          role: 'opencode_control',
          controlData: {
            controlId: 'tn-form-' + Date.now(),
            controlType: 'generar_commit_form',
            stepType: 'ambientes_diff_testing_setup',
            subStepType: 'form',
            models,
            modelValue: ocStore.savedModel || '',
            thinkingOptions: ocStore.thinkingOptions,
            thinkingValue: ocStore.savedThinking || '',
            temperatureOptions: ocStore.temperatureOptions,
            temperatureValue: ocStore.savedTemperature || '0.7',
          },
          _key: 'control-' + Date.now(),
        })
      } else if (subStepType === 'form') {
        const { model, thinking = '', mode = 'Plan', temperature = '0.7' } = value || {}
        testingNotesSetupData.model = model
        testingNotesSetupData.thinking = thinking
        testingNotesSetupData.mode = mode
        testingNotesSetupData.temperature = temperature
        await ocStore.select('model', model)
        await ocStore.select('thinking', thinking || '')
        await ocStore.select('mode', mode)
        if (temperature) await ocStore.select('temperature', temperature)
        ocStore.selectedModel = model
        ocStore.selectedThinking = thinking || ''
        ocStore.selectedMode = mode
        ocStore.selectedTemperature = temperature || ''

        const origen = testingNotesData.origen
        const destino = testingNotesData.destino
        const diffData = testingNotesData.diffData

        let diffSummary = ''
        if (diffData && diffData.commits && diffData.commits.length > 0) {
          diffSummary = diffData.commits.map(c => `- ${c.message}`).join('\n')
        }

        let prompt
        try {
          const tmplRes = await fetch('/api/templates/testing-notes-prompt', { credentials: 'include' })
          if (tmplRes.ok) {
            const tmplData = await tmplRes.json()
            prompt = tmplData.content
          } else {
            prompt = `Analizá las diferencias entre las ramas "${diffData?.sourceBranch || origen}" y "${diffData?.targetBranch || destino}" del proyecto.\n\nLos commits que diferen ambas ramas son:\n${diffSummary || '(sin commits detallados)'}\n\nGenerá un listado de puntos a considerar para realizar pruebas (testing):\n- Qué funcionalidades se ven afectadas\n- Qué se recomienda testear específicamente\n- Casos de prueba sugeridos\n\nDevolvé la respuesta en formato markdown listando cada punto.`
          }
        } catch (err) {
          console.error('Error al cargar plantilla testing-notes-prompt:', err)
          prompt = `Analizá las diferencias entre las ramas "${diffData?.sourceBranch || origen}" y "${diffData?.targetBranch || destino}" del proyecto.\n\nLos commits que diferen ambas ramas son:\n${diffSummary || '(sin commits detallados)'}\n\nGenerá un listado de puntos a considerar para realizar pruebas (testing):\n- Qué funcionalidades se ven afectadas\n- Qué se recomienda testear específicamente\n- Casos de prueba sugeridos\n\nDevolvé la respuesta en formato markdown listando cada punto.`
        }

        testingNotesData.prompt = prompt
        testingNotesData.provider = testingNotesSetupData.provider
        testingNotesData.model = model
        testingNotesData.thinking = thinking
        testingNotesData.mode = mode
        testingNotesData.temperature = temperature

        await opencodeStreamPromptTestingNotes(
          chat.activeSessionId,
          prompt,
          testingNotesSetupData.provider,
          model,
          thinking,
          mode,
          temperature,
        )
      }
    }

    async function regenerateTestingNotes(controlId, controlMsg) {
      const idx = chat.messages.findIndex((m) => m.controlData && m.controlData.controlId === controlId)
      if (idx >= 0) {
        chat.messages[idx].controlData.loading = true
      }
      await opencodeStreamPromptTestingNotes(
        chat.activeSessionId,
        testingNotesData.prompt,
        testingNotesData.provider,
        testingNotesData.model,
        testingNotesData.thinking,
        testingNotesData.mode,
        testingNotesData.temperature,
      )
    }

    async function regenerateCommit(controlId, controlMsg) {
      const idx = chat.messages.findIndex((m) => m.controlData && m.controlData.controlId === controlId)
      if (idx >= 0) {
        chat.messages[idx].controlData.loading = true
      }
      await opencodeStreamPromptCommit(
        chat.activeSessionId,
        commitData.prompt,
        commitData.provider,
        commitData.model,
        commitData.thinking,
        commitData.mode,
        commitData.temperature,
      )
    }

    async function executeCommit(controlId, controlMsg, message, addComment, modo_envio) {
      const sessionId = chat.activeSessionId
      const idx = chat.messages.findIndex((m) => m.controlData && m.controlData.controlId === controlId)
      if (idx >= 0) {
        chat.messages[idx].controlData.loading = true
      }

      try {
        const session = sessions.value.find(s => Number(s.id) === Number(sessionId))
        const idTicket = session?.id_ticket_redmine || ticketInfo.value?.redmine_id || null

        const cleanMsg = message.replace(/^\[#\d+\]\s*/g, '').trim()
        const commitMsg = idTicket ? '[#' + idTicket + '] ' + cleanMsg : cleanMsg
        const escapedMessage = commitMsg.replace(/\\/g, '\\\\').replace(/"/g, '\\"')

        const addRes = await fetch('/api/command/git', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          credentials: 'include',
          body: JSON.stringify({ command: 'add .', sessionId }),
        })
        const addData = await addRes.json()

        if (!addData.success) {
          if (idx >= 0) {
            chat.messages[idx] = {
              role: 'result',
              content: 'Error al ejecutar git add .: ' + (addData.stderr || addData.error || 'Error desconocido'),
              _key: 'err-' + Date.now(),
            }
          }
          return
        }

        const commitRes = await fetch('/api/command/git', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          credentials: 'include',
          body: JSON.stringify({ command: 'commit -m "' + escapedMessage + '"', sessionId }),
        })
        const commitData_ = await commitRes.json()

        if (!commitData_.success) {
          if (idx >= 0) {
            chat.messages[idx] = {
              role: 'result',
              content: 'Error al realizar commit: ' + (commitData_.stderr || commitData_.error || 'Error desconocido'),
              _key: 'err-' + Date.now(),
            }
          }
          return
        }

        let resultLines = ['✓ Commit realizado correctamente.', '', 'Mensaje: ' + commitMsg]

        const pushRes = await fetch('/api/command/git', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          credentials: 'include',
          body: JSON.stringify({ command: 'push', sessionId }),
        })
        const pushData = await pushRes.json()

        if (pushData.success) {
          resultLines.push('', '✓ Push realizado correctamente.')
        } else if (/(no tiene una rama upstream|no upstream|push\.autoSetupRemote)/i.test(pushData.stderr || '')) {
          const branchRes = await fetch('/api/command/git', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            credentials: 'include',
            body: JSON.stringify({ command: 'rev-parse --abbrev-ref HEAD', sessionId }),
          })
          const branchData = await branchRes.json()
          const branch = branchData.success ? branchData.stdout.trim() : 'HEAD'

          const pushUpstreamRes = await fetch('/api/command/git', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            credentials: 'include',
            body: JSON.stringify({ command: `push --set-upstream origin ${branch}`, sessionId }),
          })
          const pushUpstreamData = await pushUpstreamRes.json()
          if (pushUpstreamData.success) {
            resultLines.push('', '✓ Push realizado correctamente (upstream configurado).')
          } else {
            resultLines.push('', '✗ Error al hacer push: ' + (pushUpstreamData.stderr || '').trim())
          }
        } else if (pushData.stderr) {
          resultLines.push('', '⚠ Push: ' + pushData.stderr.trim())
        }

        if (addComment && idTicket) {
          const modoEnvio = modo_envio || 'encolar'
          if (modoEnvio === 'enviar') {
            try {
              const proyectoId = session?.proyecto_id || null
              let commitUrl = ''
              if (proyectoId) {
                const repoRes = await fetch('/api/proyecto/repositorio/' + encodeURIComponent(proyectoId), { credentials: 'include' })
                const repoData = await repoRes.json()
                if (repoData.url_github) {
                  const hashRes = await fetch('/api/command/git', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    credentials: 'include',
                    body: JSON.stringify({ command: 'rev-parse HEAD', sessionId }),
                  })
                  const hashData = await hashRes.json()
                  if (hashData.success && hashData.stdout) {
                    const hash = hashData.stdout.trim()
                    commitUrl = repoData.url_github.replace(/\/+$/, '') + '/commit/' + hash
                  }
                }
              }

              const notes = cleanMsg + '\n\n' + commitUrl
              const ticketRes = await fetch('/api/tickets/session/' + sessionId, {
                method: 'PUT',
                headers: { 'Content-Type': 'application/json' },
                credentials: 'include',
                body: JSON.stringify({ notes }),
              })
              const ticketData = await ticketRes.json()
              if (ticketData.success) {
                resultLines.push('', '✓ Comentario agregado al ticket #' + idTicket + '.')
              } else {
                resultLines.push('', '✗ Error al agregar comentario al ticket: ' + (ticketData.error || 'Error desconocido'))
              }
            } catch (err) {
              console.error('Error al agregar comentario al ticket:', err.message)
              resultLines.push('', '✗ Error al agregar comentario al ticket: ' + err.message)
            }
          } else {
            try {
              const notesBody = cleanMsg
              const commentData = await redmineComments.queueComment(sessionId, idTicket, notesBody)
              resultLines.push('', '✓ Comentario encolado para el ticket #' + idTicket + '. Usá /dev_redmine_comentarios_enviar para enviarlo.')
            } catch (err) {
              console.error('Error al encolar comentario:', err.message)
              resultLines.push('', '✗ Error al encolar comentario: ' + err.message)
            }
          }
        }

        if (idx >= 0) {
          chat.messages[idx] = {
            role: 'result',
            content: resultLines.join('\n'),
            _key: 'result-' + Date.now(),
          }
        }
      } catch (err) {
        console.error('Error al ejecutar commit:', err.message)
        if (idx >= 0) {
          chat.messages[idx] = {
            role: 'result',
            content: 'Error de conexión: ' + err.message,
            _key: 'err-' + Date.now(),
          }
        }
      } finally {
        try {
          await fetch('/api/opencode/finish', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            credentials: 'include',
            body: JSON.stringify({ ocSessionId: ocStore.ocSessionId, directory: cmdStore.currentDir || undefined }),
          })
        } catch (finishErr) {
          console.error('Error al finalizar sesión OpenCode tras commit:', finishErr.message)
        }
        ocStore.finish()
      }
    }

    async function executeAmbientesDiffComment(controlId, controlMsg, message, modo_envio) {
      const sessionId = chat.activeSessionId
      const idx = chat.messages.findIndex((m) => m.controlData && m.controlData.controlId === controlId)
      if (idx >= 0) {
        chat.messages[idx].controlData.loading = true
      }

      try {
        const session = sessions.value.find(s => Number(s.id) === Number(sessionId))
        const idTicket = session?.id_ticket_redmine || ticketInfo.value?.redmine_id || null

        if (!idTicket) {
          if (idx >= 0) {
            chat.messages[idx] = {
              role: 'result',
              content: 'No hay ticket asociado a la sesión. Use /chat_set_ticket para asignar uno.',
              _key: 'err-' + Date.now(),
            }
          }
          return
        }

        const notesBody = message.trim()

        if (modo_envio === 'enviar') {
          try {
            const ticketRes = await fetch('/api/tickets/session/' + sessionId, {
              method: 'PUT',
              headers: { 'Content-Type': 'application/json' },
              credentials: 'include',
              body: JSON.stringify({ notes: notesBody }),
            })
            const ticketData = await ticketRes.json()

            if (idx >= 0) {
              if (ticketData.success) {
                chat.messages[idx] = {
                  role: 'result',
                  content: '✓ Comentario enviado al ticket #' + idTicket + '.',
                  _key: 'result-' + Date.now(),
                }
              } else {
                chat.messages[idx] = {
                  role: 'result',
                  content: '✗ Error al enviar comentario: ' + (ticketData.error || 'Error desconocido'),
                  _key: 'err-' + Date.now(),
                }
              }
            }
          } catch (err) {
            console.error('Error al enviar comentario al ticket:', err.message)
            if (idx >= 0) {
              chat.messages[idx] = {
                role: 'result',
                content: '✗ Error al enviar comentario: ' + err.message,
                _key: 'err-' + Date.now(),
              }
            }
          }
        } else {
          try {
            await redmineComments.queueComment(sessionId, idTicket, notesBody)
            if (idx >= 0) {
              chat.messages[idx] = {
                role: 'result',
                content: '✓ Comentario encolado para el ticket #' + idTicket + '. Usá /dev_redmine_comentarios_enviar para enviarlo.',
                _key: 'result-' + Date.now(),
              }
            }
          } catch (err) {
            console.error('Error al encolar comentario:', err.message)
            if (idx >= 0) {
              chat.messages[idx] = {
                role: 'result',
                content: '✗ Error al encolar comentario: ' + err.message,
                _key: 'err-' + Date.now(),
              }
            }
          }
        }
      } catch (err) {
        console.error('Error al procesar comentario de diff:', err.message)
        if (idx >= 0) {
          chat.messages[idx] = {
            role: 'result',
            content: 'Error de conexión: ' + err.message,
            _key: 'err-' + Date.now(),
          }
        }
      } finally {
        const fromTestingNotes = controlMsg?.controlData?.fromTestingNotes
        if (fromTestingNotes) {
          try {
            await fetch('/api/opencode/finish', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              credentials: 'include',
              body: JSON.stringify({ ocSessionId: ocStore.ocSessionId, directory: cmdStore.currentDir || undefined }),
            })
          } catch (finishErr) {
            console.error('Error al cerrar sesión OpenCode:', finishErr.message)
          }
          ocStore.finish()
        }
      }
    }

    async function addMessage(role, content, extra) {
      const msg = { role, content, _key: 'msg-' + Date.now() + '-' + Math.random(), ...extra }
      chat.pushMessage(msg)
      return msg
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
          if (data.success) {
            return data.result
          }
          throw new Error(data.result || 'Error al ejecutar comando')
        })
      } finally {
        await fetchGitBranch()
      }
    }

    let resizeObserver = null

    async function scrollToBottom() {
      await nextTick()
      await new Promise((resolve) => requestAnimationFrame(resolve))
      if (messagesContainer.value) {
        messagesContainer.value.scrollLeft = messagesContainer.value.scrollWidth
      }
      setTimeout(() => {
        if (messagesContainer.value) {
          messagesContainer.value.scrollLeft = messagesContainer.value.scrollWidth
        }
      }, 100)
    }

    watch(messages, scrollToBottom, { deep: true })
    watch([currentChunk, ocChunk], scrollToBottom)

    watch(activeSessionId, () => {
      loadTicketInfo()
      fetchGitBranch()
      scrollToBottom()
    })

    watch(() => cmdStore.currentDir, () => {
      fetchGitBranch()
    })

    watch(
      () => {
        const s = sessions.value.find(s => Number(s.id) === Number(activeSessionId.value))
        return s?.id_ticket_redmine
      },
      () => {
        loadTicketInfo()
      }
    )

    let wheelHandler = null
    onMounted(() => {
      if (messagesContainer.value) {
        resizeObserver = new ResizeObserver(() => {
          if (messagesContainer.value) {
            messagesContainer.value.scrollLeft = messagesContainer.value.scrollWidth
          }
        })
        resizeObserver.observe(messagesContainer.value)

        wheelHandler = (e) => {
          if (Math.abs(e.deltaY) > Math.abs(e.deltaX)) {
            e.preventDefault()
            messagesContainer.value.scrollLeft += e.deltaY
          }
        }
        messagesContainer.value.addEventListener('wheel', wheelHandler, { passive: false })
      }
      loadTicketInfo()
      loadZoom()
      fetchGitBranch()
    })

    onUnmounted(() => {
      if (resizeObserver) resizeObserver.disconnect()
      if (wheelHandler && messagesContainer.value) {
        messagesContainer.value.removeEventListener('wheel', wheelHandler)
      }
    })

    return {
      activeSessionId,
      messages,
      streaming,
      executing,
      currentChunk,
      currentThinking,
      ocStreaming,
      ocChunk,
      ocThinking,
      _streamSessionId,
      _isActiveSession,
      input,
      send,
      onControlConfirm,
      onContextMenu,
      closeCtxMenu,
      deleteMessage,
      ctxMenu,
      rawMsgKeys,
      msgKey,
      toggleRawView,
      clearChat,
      deteccionState,
      abortDeteccion,
      messagesContainer,
      ticketInfo,
      priorityClass,
      gitStore,
      zoomIn,
      zoomOut,
      saveZoom,
    }
  },
}
</script>

<style>
html, body {
  overflow-x: hidden;
}
.branch-name {
  color: #3fb950;
  font-size: 0.8rem;
  white-space: nowrap;
}
.blink {
  animation: blink 1s step-end infinite;
}
@keyframes blink {
  50% { opacity: 0; }
}
.context-menu-backdrop {
  position: fixed;
  top: 0; left: 0; right: 0; bottom: 0;
  z-index: 1040;
}
.context-menu {
  position: fixed;
  z-index: 1050;
  background: #1a2744;
  border: 1px solid #75AADB;
  border-radius: 6px;
  padding: 4px 0;
  min-width: 180px;
  box-shadow: 0 4px 12px rgba(0,0,0,0.4);
}
.context-menu-item {
  padding: 8px 16px;
  cursor: pointer;
  font-size: 0.875rem;
  color: #e0e0e0;
}
.context-menu-item:hover {
  background: #1a2a4e;
}
.context-menu-item.text-danger {
  color: #f87171 !important;
}
.context-menu-item.text-danger:hover {
  background: #3a1a1a;
}

.btn-argentina {
  background-color: #75AADB;
  color: #fff;
  border: 1px solid #75AADB;
}
.btn-argentina:hover {
  background-color: #5a8fc0;
  color: #fff;
}
.btn-argentina:disabled {
  opacity: 0.6;
}
.btn-outline-argentina {
  background-color: transparent;
  color: #75AADB;
  border: 1px solid #75AADB;
}
.btn-outline-argentina:hover {
  background-color: #1a2744;
  color: #75AADB;
}
.ticket-info-bar {
  background: #0f1a2e;
  border-bottom: 1px solid #374151;
  font-size: 0.8rem;
  color: #9ca3af;
  min-height: 32px;
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
.ticket-id {
  color: #fbbf24;
  font-weight: 600;
}
.ticket-subject {
  color: #e0e0e0;
  overflow: hidden;
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

/* --- Paginación horizontal --- */
.messages-pages {
  position: absolute;
  inset: 0;
  display: flex;
  flex-direction: column;
  flex-wrap: wrap;
  align-content: flex-start;
  gap: 0.75rem;
  padding: 1rem;
  overflow-x: auto;
  overflow-y: hidden;
  scroll-behavior: smooth;
}
.messages-pages > * {
  flex-shrink: 0;
  width: calc(50% - 1.375rem);
  margin-bottom: 0 !important;
}
</style>
