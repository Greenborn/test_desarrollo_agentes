<template>
  <div class="d-flex flex-column h-100">
    <div class="flex-grow-1 overflow-auto p-3" ref="messagesContainer">
      <div v-if="!activeSessionId" class="text-center text-muted mt-5">
        <h5>Selecciona o crea un nuevo chat</h5>
      </div>
      <template v-else>
        <ChatMessage v-for="m in messages" :key="m.id || m._key" :msg="m" @control-confirm="onControlConfirm" />
        <div v-if="streaming" class="text-start mb-3">
          <div class="d-inline-block bg-light border rounded-3 p-3 text-start" style="max-width: 80%;">
            <div v-if="currentThinking" class="mb-2">
              <button class="btn btn-sm btn-outline-secondary w-100 text-start" data-bs-toggle="collapse" data-bs-target="#think-stream">
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
          <div class="d-inline-block rounded-3 p-3 text-start" style="max-width: 90%; background: #0f0f1e; border: 1px solid #7c3aed; color: #e0e0e0;">
            <div v-if="ocThinking" class="mb-2">
              <button class="btn btn-sm btn-outline-secondary w-100 text-start" data-bs-toggle="collapse" data-bs-target="#oc-think-stream">
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
    <div class="border-top p-2" v-if="activeSessionId">
      <form @submit.prevent="send" class="d-flex gap-2">
        <input
          v-model="input"
          class="form-control"
          placeholder="Escribe tu mensaje..."
          :disabled="streaming"
        />
        <button class="btn btn-primary" :disabled="streaming || !input.trim()">Enviar</button>
      </form>
    </div>
  </div>
</template>

<script>
import { ref, watch, nextTick } from 'vue'
import { storeToRefs } from 'pinia'
import { useChatStore } from '../stores/chat.js'
import { useCommandStore } from '../stores/command.js'
import { useModalStore } from '../stores/modal.js'
import { useOpencodeStore } from '../stores/opencode.js'
import { useCommandRegistry } from '../composables/useCommandRegistry.js'
import ChatMessage from './ChatMessage.vue'
import HelpContent from './HelpModal.vue'

export default {
  components: { ChatMessage },
  setup() {
    const chat = useChatStore()
    const cmdStore = useCommandStore()
    const modal = useModalStore()
    const ocStore = useOpencodeStore()
    const { find } = useCommandRegistry()
    const { activeSessionId, messages, streaming, currentChunk, currentThinking } = storeToRefs(chat)
    const input = ref('')
    const messagesContainer = ref(null)
    const ocStreaming = ref(false)
    const ocChunk = ref('')
    const ocThinking = ref('')

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

    async function onControlConfirm({ controlId, value }) {
      // Find the control message to determine type
      const controlMsg = chat.messages.find((m) => m.controlData && m.controlData.controlId === controlId)
      const controlType = controlMsg && controlMsg.controlData ? controlMsg.controlData.controlType : ''
      const stepType = controlMsg && controlMsg.controlData ? controlMsg.controlData.stepType : ''

      if (stepType === 'opencode_setup') {
        await handleOpencodeSetup(controlId, value, controlMsg)
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
      const args = parts.slice(1)
      const sessionId = chat.activeSessionId

      const known = find(cmdName)
      if (known) {
        if (cmdName === '/help') {
          modal.open(HelpContent, {})
          return
        }
        known.execute(args, { cmdStore, chatStore: chat })
      } else {
        try {
          const res = await fetch('/api/command/execute', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            credentials: 'include',
            body: JSON.stringify({ command: raw, sessionId }),
          })
          const data = await res.json()
          if (data.success) {
            chat.loadMessages(sessionId)
          } else {
            console.error('Error al ejecutar comando:', data.result)
          }
        } catch (err) {
          console.error('Error al ejecutar comando:', err)
        }
      }
    }

    watch(
      () => [chat.messages.length, chat.currentChunk, ocChunk.value],
      async () => {
        await nextTick()
        if (messagesContainer.value) {
          messagesContainer.value.scrollTop = messagesContainer.value.scrollHeight
        }
      },
      { deep: true }
    )

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
      messagesContainer,
    }
  },
}
</script>

<style>
.blink {
  animation: blink 1s step-end infinite;
}
@keyframes blink {
  50% { opacity: 0; }
}
</style>
