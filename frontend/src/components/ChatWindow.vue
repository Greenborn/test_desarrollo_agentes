<template>
  <div class="d-flex flex-column h-100 overflow-x-hidden" @click="closeCtxMenu">
    <div class="flex-grow-1 overflow-y-auto p-3" ref="messagesContainer">
      <div v-if="!activeSessionId" class="text-center text-muted mt-5">
        <h5 class="text-white">Selecciona o crea un nuevo chat</h5>
      </div>
      <template v-else>
        <ChatMessage v-for="m in messages" :key="m.id || m._key" :msg="m" @control-confirm="onControlConfirm" @contextmenu="onContextMenu" />
        <div v-if="streaming" class="text-start mb-3">
          <div class="d-inline-block rounded-3 p-3 text-start" style="max-width: 80%; background: #1a1a2e; border: 1px solid #374151; color: #e0e0e0;">
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
        <div v-if="ocStreaming" class="text-start mb-3">
          <div class="d-inline-block rounded-3 p-3 text-start" style="max-width: 90%; background: #0f0f1e; border: 1px solid #75AADB; color: #f0f0f0;">
            <div v-if="ocThinking" class="mb-2">
              <button class="btn btn-sm w-100 text-start btn-outline-argentina" data-bs-toggle="collapse" data-bs-target="#oc-think-stream">
                🧠 OpenCode razonando...
              </button>
              <div class="collapse show mt-1" id="oc-think-stream">
                <pre class="mb-0 small text-muted" style="white-space: pre-wrap;">{{ ocThinking }}</pre>
              </div>
            </div>
            <div style="white-space: pre-wrap;">{{ ocChunk }}<span class="blink">▌</span></div>
          </div>
        </div>
      </template>
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
import { useCommandRegistry } from '../composables/useCommandRegistry.js'
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
    const { find } = useCommandRegistry()
    const { activeSessionId, messages, streaming, executing, currentChunk, currentThinking } = storeToRefs(chat)
    const input = ref('')
    const messagesContainer = ref(null)
    const ocStreaming = ref(false)
    const ocChunk = ref('')
    const ocThinking = ref('')
    const docUpdateProyectoId = ref('')
    const docUpdateType = ref('')
    const ctxMenu = reactive({ show: false, x: 0, y: 0, msg: null })

    function send() {
      const raw = input.value.trim()
      if (!raw || !chat.activeSessionId) return
      input.value = ''

      if (raw.startsWith('/')) {
        executeCommand(raw)
      } else {
        chat.sendMessage(chat.activeSessionId, raw)
      }
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

    async function deleteMessage(msg) {
      try {
        await chat.deleteMessage(chat.activeSessionId, msg)
      } catch (err) {
        console.error('Error al eliminar mensaje:', err)
      }
      closeCtxMenu()
    }

    async function opencodeStreamPrompt(sessionId, prompt, provider, model, thinking, mode) {
      ocStreaming.value = true
      ocChunk.value = ''
      ocThinking.value = ''

      const streamMsg = await addMessage('opencode_stream', '', { streaming: true })
      streamMsg._key = 'stream-' + Date.now()

      await ocStore.streamPrompt(sessionId, prompt, provider, model, thinking, mode, {
        onChunk(content) {
          ocChunk.value += content
        },
        onThinking(content) {
          ocThinking.value += content
        },
        onControl(control) {
          chat.messages.push({
            role: 'opencode_control',
            content: JSON.stringify(control),
            controlData: control,
            _key: 'control-' + Date.now(),
          })
        },
        onDone(json, fullText) {
          ocStreaming.value = false
          const idx = chat.messages.findIndex((m) => m._key === streamMsg._key)
          if (idx >= 0) {
            chat.messages[idx].streaming = false
            chat.messages[idx].role = 'opencode_result'
            chat.messages[idx].content = json.fullResponse || fullText || '(sin respuesta)'
          }
          // Add follow-up prompt control with model and thinking selectors
          chat.messages.push({
            role: 'opencode_control',
            controlData: {
              controlId: 'followup-' + Date.now(),
              controlType: 'followup',
              models: ocStore.getModelsForProvider(ocStore.selectedProvider),
              modelValue: ocStore.selectedModel || '',
              thinkingOptions: ocStore.thinkingOptions,
              thinkingValue: ocStore.selectedThinking || '',
              placeholder: 'Escribe otro mensaje para OpenCode...',
              rows: 3,
            },
            _key: 'control-' + Date.now(),
          })
        },
        onError(msg) {
          ocStreaming.value = false
          const idx = chat.messages.findIndex((m) => m._key === streamMsg._key)
          if (idx >= 0) {
            chat.messages[idx].content = `[Error: ${msg}]`
            chat.messages[idx].streaming = false
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

    async function opencodeStreamPromptDocUpdate(sessionId, prompt, provider, model, thinking, mode, proyectoId, tipo) {
      ocStreaming.value = true
      ocChunk.value = ''
      ocThinking.value = ''

      const streamMsg = await addMessage('opencode_stream', '', { streaming: true })
      streamMsg._key = 'stream-' + Date.now()

      await ocStore.streamPrompt(sessionId, prompt, provider, model, thinking, mode, {
        onChunk(content) {
          ocChunk.value += content
        },
        onThinking(content) {
          ocThinking.value += content
        },
        onControl(control) {
          chat.messages.push({
            role: 'opencode_control',
            content: JSON.stringify(control),
            controlData: control,
            _key: 'control-' + Date.now(),
          })
        },
        async onDone(json, fullText) {
          ocStreaming.value = false
          const idx = chat.messages.findIndex((m) => m._key === streamMsg._key)
          const fullResponse = json.fullResponse || fullText || '(sin respuesta)'
          if (idx >= 0) {
            chat.messages[idx].streaming = false
            chat.messages[idx].role = 'opencode_result'
            chat.messages[idx].content = fullResponse
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
            chat.messages.push({
              role: 'result',
              content: `Documentación de ${label} actualizada correctamente para el proyecto "${proyectoId}".`,
              _key: 'result-' + Date.now(),
            })
          } catch (err) {
            console.error('Error al guardar documentación:', err.message)
            chat.messages.push({
              role: 'result',
              content: 'Error al guardar documentación: ' + err.message,
              _key: 'result-' + Date.now(),
            })
          }
        },
        onError(msg) {
          ocStreaming.value = false
          const idx = chat.messages.findIndex((m) => m._key === streamMsg._key)
          if (idx >= 0) {
            chat.messages[idx].content = '[Error: ' + msg + ']'
            chat.messages[idx].streaming = false
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
      } else if (stepType === 'documentacion_update') {
        await handleDocumentacionUpdate(controlId, value, controlMsg)
      } else if (controlType === 'funcionalidad_list') {
        modal.open(FuncionalidadWizard, {
          sessionId: value.sessionId,
          proyectoId: value.proyectoId,
        }, { title: 'Editar funcionalidad', wide: true })
        return
      } else if (controlType === 'followup') {
        // Follow-up prompt with model/thinking selectors
        const { model, thinking, prompt } = value
        if (!prompt) return
        ocStore.selectedModel = model || ocStore.selectedModel
        ocStore.selectedThinking = thinking || ocStore.selectedThinking
        await opencodeStreamPrompt(
          chat.activeSessionId,
          prompt,
          ocStore.selectedProvider,
          ocStore.selectedModel,
          ocStore.selectedThinking,
          ocStore.selectedMode,
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
    let docUpdateData = { provider: '', model: '', thinking: '', mode: '' }

    async function handleDocumentacionUpdate(controlId, value, controlMsg) {
      const subStepType = controlMsg.controlData.subStepType

      if (subStepType === 'provider') {
        docUpdateData.provider = value
        docUpdateProyectoId.value = controlMsg.controlData.proyectoId || ''
        docUpdateType.value = controlMsg.controlData.docType || ''
        await ocStore.select('provider', value)
        ocStore.selectedProvider = value
        const models = ocStore.getModelsForProvider(value)
        chat.messages.push({
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
          chat.messages.push({
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

            chat.messages.push({
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
              docUpdateProyectoId.value,
              tipo,
            )
          }

          if (docUpdateType.value === 'all') {
            chat.messages.push({
              role: 'result',
              content: 'Documentación completada para todos los tipos.',
              _key: 'result-' + Date.now(),
            })
          }
        } catch (err) {
          console.error('Error al obtener prompt de documentación:', err.message)
          chat.messages.push({
            role: 'result',
            content: 'Error al obtener prompt de documentación: ' + err.message,
            _key: 'result-' + Date.now(),
          })
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
        chat.messages.push({
          role: 'opencode_control',
          controlData: {
            controlId: 'model-' + Date.now(),
            controlType: 'select',
            stepType: 'opencode_setup',
            subStepType: 'model',
            options: models,
            placeholder: 'Selecciona modelo...',
            preselect: ocStore.savedModel || '',
          },
          _key: 'control-' + Date.now(),
        })
      } else if (subStepType === 'model') {
        ocSetupData.model = value
        await ocStore.select('model', value)
        ocStore.selectedModel = value
        if (ocStore.modelSupportsReasoning(ocSetupData.provider, value)) {
          chat.messages.push({
            role: 'opencode_control',
            controlData: {
              controlId: 'thinking-' + Date.now(),
              controlType: 'select',
              stepType: 'opencode_setup',
              subStepType: 'thinking',
              options: ocStore.thinkingOptions,
              placeholder: 'Selecciona nivel de pensamiento...',
              preselect: ocStore.savedThinking || 'medium',
            },
            _key: 'control-' + Date.now(),
          })
        } else {
          // Skip thinking step, go directly to mode
          const fakeMsg = { controlData: { subStepType: 'thinking' } }
          await handleOpencodeSetup(null, null, fakeMsg)
        }
      } else if (subStepType === 'thinking') {
        ocSetupData.thinking = value
        await ocStore.select('thinking', value)
        ocStore.selectedThinking = value
        chat.messages.push({
          role: 'opencode_control',
          controlData: {
            controlId: 'mode-' + Date.now(),
            controlType: 'select',
            stepType: 'opencode_setup',
            subStepType: 'mode',
            options: [
              { label: 'Plan — solo planificar, sin cambios', value: 'Plan' },
              { label: 'Build — planificar y ejecutar cambios', value: 'Build' },
            ],
            placeholder: 'Selecciona modo...',
            preselect: ocStore.savedMode || 'Build',
          },
          _key: 'control-' + Date.now(),
        })
      } else if (subStepType === 'mode') {
        ocSetupData.mode = value
        await ocStore.select('mode', value)
        ocStore.selectedMode = value
        chat.messages.push({
          role: 'opencode_control',
          controlData: {
            controlId: 'prompt-' + Date.now(),
            controlType: 'textarea',
            stepType: 'opencode_setup',
            subStepType: 'prompt',
            placeholder: 'Describe qué quieres que OpenCode haga...',
            rows: 5,
          },
          _key: 'control-' + Date.now(),
        })
      } else if (subStepType === 'prompt') {
        ocSetupData.prompt = value
        await opencodeStreamPrompt(
          chat.activeSessionId,
          value,
          ocSetupData.provider,
          ocSetupData.model,
          ocSetupData.thinking,
          ocSetupData.mode,
        )
      }
    }

    async function addMessage(role, content, extra) {
      const msg = { role, content, _key: 'msg-' + Date.now() + '-' + Math.random(), ...extra }
      chat.messages.push(msg)
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

      await chat.runCommand(raw, async (loadingIdx) => {
        if (known) {
          return known.execute(parts.slice(1), { cmdStore, chatStore: chat, loadingIdx })
        }
        const res = await fetch('/api/command/execute', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          credentials: 'include',
          body: JSON.stringify({ command: raw, sessionId: chat.activeSessionId }),
        })
        const data = await res.json()
        if (data.success) {
          await chat.loadMessages(chat.activeSessionId)
          return null
        }
        throw new Error(data.result || 'Error al ejecutar comando')
      })
    }

    let resizeObserver = null

    async function scrollToBottom() {
      await nextTick()
      await new Promise((resolve) => requestAnimationFrame(resolve))
      if (messagesContainer.value) {
        messagesContainer.value.scrollTop = messagesContainer.value.scrollHeight
      }
    }

    watch(() => chat.messages.length, scrollToBottom)
    watch([currentChunk, ocChunk], scrollToBottom)

    onMounted(() => {
      if (messagesContainer.value) {
        resizeObserver = new ResizeObserver(() => {
          if (messagesContainer.value) {
            messagesContainer.value.scrollTop = messagesContainer.value.scrollHeight
          }
        })
        resizeObserver.observe(messagesContainer.value)
      }
    })

    onUnmounted(() => {
      if (resizeObserver) resizeObserver.disconnect()
    })

    return {
      activeSessionId,
      messages,
      streaming,
      currentChunk,
      currentThinking,
      ocStreaming,
      ocChunk,
      ocThinking,
      input,
      send,
      onControlConfirm,
      onContextMenu,
      closeCtxMenu,
      deleteMessage,
      ctxMenu,
      messagesContainer,
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
.context-menu-backdrop {
  position: fixed;
  top: 0; left: 0; right: 0; bottom: 0;
  z-index: 1040;
}
.context-menu {
  position: fixed;
  z-index: 1050;
  background: #1a1a2e;
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
</style>
