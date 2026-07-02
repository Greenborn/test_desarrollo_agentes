<template>
  <div class="file-editor-occhat d-flex flex-column h-100" style="background: #0d1117;">
    <div v-if="!agentActive" class="d-flex flex-column p-2 flex-grow-1 overflow-y-auto" style="min-height: 0;">
      <div class="small text-light-emphasis mb-2 fw-semibold">Agente OpenCode</div>
      <div class="mb-2">
        <label class="small text-muted mb-1">Provider</label>
        <select v-model="provider" class="form-select form-select-sm bg-dark text-light border-secondary font-monospace">
          <option value="" disabled>Selecciona provider...</option>
          <option v-for="p in providers" :key="p.value" :value="p.value">{{ p.label }}</option>
        </select>
      </div>
      <div class="mb-2">
        <label class="small text-muted mb-1">Modelo</label>
        <select v-model="model" class="form-select form-select-sm bg-dark text-light border-secondary font-monospace">
          <option value="" disabled>Selecciona modelo...</option>
          <option v-for="m in models" :key="m.value" :value="m.value">{{ m.label }}</option>
        </select>
      </div>
      <div v-if="modelSupportsReasoning" class="mb-2">
        <label class="small text-muted mb-1">Pensamiento</label>
        <select v-model="thinking" class="form-select form-select-sm bg-dark text-light border-secondary font-monospace">
          <option v-for="t in thinkingOptions" :key="t.value" :value="t.value">{{ t.label }}</option>
        </select>
      </div>
      <div class="mb-2">
        <label class="small text-muted mb-1">Temp.</label>
        <select v-model="temperature" class="form-select form-select-sm bg-dark text-light border-secondary font-monospace">
          <option v-for="t in temperatureOptions" :key="t.value" :value="t.value">{{ t.label }}</option>
        </select>
      </div>
      <div class="mb-2">
        <label class="small text-muted mb-1">Modo</label>
        <div class="btn-group btn-group-sm w-100" role="group">
          <button type="button" class="btn btn-sm font-monospace" :class="mode === 'Plan' ? 'btn-warning' : 'btn-outline-secondary'" @click="mode = 'Plan'">Plan</button>
          <button type="button" class="btn btn-sm font-monospace" :class="mode === 'Build' ? 'btn-success' : 'btn-outline-secondary'" @click="mode = 'Build'">Build</button>
        </div>
      </div>
      <div class="mt-auto">
        <button class="btn btn-sm btn-success w-100" :disabled="initializing || !provider || !model" @click="initAgent">
          <span v-if="initializing" class="spinner-border spinner-border-sm me-1"></span>
          {{ initializing ? 'Inicializando...' : 'Iniciar agente OpenCode' }}
        </button>
      </div>
      <div v-if="error" class="text-danger small mt-2">{{ error }}</div>
    </div>

    <div v-else class="d-flex flex-column flex-grow-1 overflow-hidden" style="min-height: 0;">
      <div class="d-flex align-items-center px-2 py-1 flex-shrink-0" style="border-bottom: 1px solid #374151;">
        <span class="small text-light-emphasis fw-semibold">OpenCode</span>
        <span class="badge bg-success ms-2" style="font-size: 0.55rem;">{{ mode }} activo</span>
        <button class="btn btn-sm btn-outline-danger ms-auto py-0 px-2" style="font-size: 0.65rem;" @click="finishAgent">✕ Cerrar</button>
      </div>

      <div ref="chatContainer" class="chat-messages flex-grow-1 overflow-y-auto px-2 py-1" style="min-height: 0;">
        <div v-for="(msg, i) in messages" :key="i" class="mb-2">
          <div v-if="msg.thinking" class="mb-1">
            <button class="btn btn-sm btn-link text-muted p-0 text-start text-decoration-none" style="font-size: 0.65rem;" @click="toggleThinking(i)">
              {{ thinkingOpen[i] ? '▼' : '▶' }} Razonamiento
            </button>
            <div v-if="thinkingOpen[i]" class="thinking-content text-muted small p-2 rounded mt-1" style="background: #1a1a2e; font-size: 0.7rem; white-space: pre-wrap; max-height: 200px; overflow-y-auto;">
              {{ msg.thinking }}
            </div>
          </div>
          <div class="msg-bubble small p-2 rounded" :class="msg.role === 'user' ? 'msg-user bg-primary text-white ms-3' : 'msg-assistant bg-dark text-light me-3'" style="font-size: 0.75rem; line-height: 1.4;">
            <div v-if="msg.role === 'user'">{{ msg.content }}</div>
            <ChatFormatter v-else :text="msg.content" />
          </div>
        </div>
        <div v-if="streaming" class="mb-2 me-3">
          <div v-if="streamThinking" class="mb-1">
            <button class="btn btn-sm btn-link text-muted p-0 text-start text-decoration-none" style="font-size: 0.65rem;" @click="streamThinkingOpen = !streamThinkingOpen">
              {{ streamThinkingOpen ? '▼' : '▶' }} Razonando...
            </button>
            <div v-if="streamThinkingOpen" class="thinking-content text-muted small p-2 rounded mt-1" style="background: #1a1a2e; font-size: 0.7rem; white-space: pre-wrap; max-height: 200px; overflow-y-auto;">
              {{ streamThinking }}
            </div>
          </div>
          <div class="msg-bubble small p-2 rounded msg-assistant bg-dark text-light" style="font-size: 0.75rem; line-height: 1.4;">
            <ChatFormatter :text="streamText" />
            <span class="streaming-cursor">▊</span>
          </div>
        </div>
        <div v-if="messages.length === 0 && !streaming" class="d-flex flex-column align-items-center justify-content-center text-secondary small py-4">
          <span>Agente listo. Enviá tu primer mensaje.</span>
        </div>
      </div>

      <div class="d-flex gap-1 p-2 border-top" style="border-color: #374151 !important;">
        <textarea
          v-model="input"
          class="form-control form-control-sm bg-dark text-light border-secondary font-monospace"
          rows="2"
          :placeholder="streaming ? 'OpenCode está procesando...' : 'Escribe tu mensaje...'"
          :disabled="streaming"
          style="resize: none; font-size: 0.75rem;"
          @keydown="onTextareaKeydown"
        ></textarea>
        <div class="d-flex flex-column gap-1 flex-shrink-0">
          <button class="btn btn-sm btn-success py-1 px-2" :disabled="streaming || !input.trim()" @click="send">Enviar</button>
          <button class="btn btn-sm btn-outline-warning py-1 px-2" :disabled="!streaming" @click="abort">⏹</button>
        </div>
      </div>
    </div>
  </div>
</template>

<script>
import { ref, computed, onMounted, watch, nextTick } from 'vue'
import ChatFormatter from '../chat/ChatFormatter.vue'

const API = '/api'

const thinkingOptions = [
  { label: 'Low — mínimo esfuerzo', value: 'low' },
  { label: 'Medium — equilibrio', value: 'medium' },
  { label: 'High — máximo razonamiento', value: 'high' },
]

const temperatureOptions = [
  { label: 'Precisa (0.0)', value: '0' },
  { label: 'Balanceada (0.7)', value: '0.7' },
  { label: 'Creativa (1.5)', value: '1.5' },
]

export default {
  components: { ChatFormatter },
  props: {
    cwd: { type: String, default: null },
  },
  setup(props) {
    const provider = ref('')
    const model = ref('')
    const thinking = ref('')
    const mode = ref('Plan')
    const temperature = ref('0.7')

    const providers = ref([])
    const modelsData = ref({})
    const agentActive = ref(false)
    const initializing = ref(false)
    const streaming = ref(false)
    const ocSessionId = ref(null)

    const messages = ref([])
    const input = ref('')
    const error = ref('')

    const streamText = ref('')
    const streamThinking = ref('')
    const streamThinkingOpen = ref(false)
    const thinkingOpen = ref({})

    const chatContainer = ref(null)

    const models = computed(() => {
      if (!provider.value || !modelsData.value[provider.value]) return []
      return Object.keys(modelsData.value[provider.value]).map(key => {
        const m = modelsData.value[provider.value][key]
        return {
          label: m.name || key,
          value: key,
          reasoning: m.capabilities ? m.capabilities.reasoning : false,
        }
      })
    })

    const modelSupportsReasoning = computed(() => {
      if (!provider.value || !model.value || !modelsData.value[provider.value]) return false
      const m = modelsData.value[provider.value][model.value]
      if (!m) return false
      return m.capabilities ? m.capabilities.reasoning || false : false
    })

    function toggleThinking(i) {
      thinkingOpen.value = { ...thinkingOpen.value, [i]: !thinkingOpen.value[i] }
    }

    async function loadProviders() {
      if (!props.cwd) return
      try {
        const res = await fetch(`${API}/opencode/editor-start`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          credentials: 'include',
          body: JSON.stringify({ cwd: props.cwd }),
        })
        const data = await res.json()
        if (data.error) {
          error.value = data.error
          return
        }
        providers.value = (data.providers || []).map(p => ({
          label: p.name || p.id,
          value: p.id,
        }))
        modelsData.value = {}
        for (const p of (data.providers || [])) {
          modelsData.value[p.id] = p.models || {}
        }
        if (data.defaultModels) {
          const defaultProv = Object.keys(data.defaultModels)[0]
          if (defaultProv && modelsData.value[defaultProv]) {
            provider.value = defaultProv
            const defaultModel = data.defaultModels[defaultProv]
            if (defaultModel && modelsData.value[defaultProv][defaultModel]) {
              model.value = defaultModel
            }
          }
        }
      } catch (err) {
        console.error('Error al cargar providers para editor:', err)
        error.value = 'Error al cargar providers'
      }
    }

    async function initAgent() {
      if (!props.cwd || !provider.value || !model.value) return
      initializing.value = true
      error.value = ''
      try {
        const res = await fetch(`${API}/opencode/editor-start`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          credentials: 'include',
          body: JSON.stringify({ cwd: props.cwd }),
        })
        const data = await res.json()
        if (data.error) {
          error.value = data.error
          initializing.value = false
          return
        }
        agentActive.value = true
      } catch (err) {
        console.error('Error al iniciar agente editor:', err)
        error.value = err.message || 'Error al iniciar agente'
      } finally {
        initializing.value = false
      }
    }

    async function send() {
      const text = input.value.trim()
      if (!text || streaming.value || !props.cwd) return

      messages.value.push({ role: 'user', content: text })
      input.value = ''

      streaming.value = true
      streamText.value = ''
      streamThinking.value = ''

      await nextTick()
      scrollToBottom()

      try {
        const res = await fetch(`${API}/opencode/editor-send`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          credentials: 'include',
          body: JSON.stringify({
            prompt: text,
            provider: provider.value,
            model: model.value,
            thinking: thinking.value,
            mode: mode.value,
            temperature: temperature.value,
            cwd: props.cwd,
          }),
        })

        if (!res.ok) {
          let errMsg = 'Error en conexión con OpenCode'
          try { const errData = await res.json(); if (errData.error) errMsg = errData.error } catch (e) { console.error(e) }
          messages.value.push({ role: 'assistant', content: `[Error: ${errMsg}]` })
          streaming.value = false
          return
        }

        const reader = res.body.getReader()
        const decoder = new TextDecoder()
        let buf = ''
        let doneReceived = false
        let localResponse = ''
        let localThinking = ''

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
                localResponse += j.content
                streamText.value = localResponse
              } else if (j.type === 'thinking') {
                localThinking += j.content
                streamThinking.value = localThinking
              } else if (j.type === 'control_request') {
                // Auto-accept for now
              } else if (j.type === 'done') {
                doneReceived = true
                ocSessionId.value = j.ocSessionId || j.hash || null
                messages.value.push({
                  role: 'assistant',
                  content: j.fullResponse || localResponse || '(sin respuesta)',
                  thinking: j.thinking || localThinking || null,
                })
                streaming.value = false
                streamText.value = ''
                streamThinking.value = ''
                await nextTick()
                scrollToBottom()
              } else if (j.type === 'error') {
                messages.value.push({ role: 'assistant', content: `[Error: ${j.content}]` })
                streaming.value = false
              }
            } catch (e) {
              console.error('Error parseando SSE:', e)
            }
          }
        }

        if (!doneReceived) {
          if (localResponse) {
            messages.value.push({
              role: 'assistant',
              content: localResponse,
              thinking: localThinking || null,
            })
          }
          streaming.value = false
          streamText.value = ''
          streamThinking.value = ''
          await nextTick()
          scrollToBottom()
        }
      } catch (err) {
        console.error('Error en editor-send:', err)
        messages.value.push({ role: 'assistant', content: `[Error: ${err.message}]` })
        streaming.value = false
      }
    }

    async function abort() {
      if (!ocSessionId.value && !props.cwd) return
      try {
        await fetch(`${API}/opencode/editor-abort`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          credentials: 'include',
          body: JSON.stringify({ ocSessionId: ocSessionId.value, cwd: props.cwd }),
        })
      } catch (err) {
        console.error('Error al abortar:', err)
      }
      streaming.value = false
      if (streamText.value) {
        messages.value.push({
          role: 'assistant',
          content: streamText.value || '(abortado)',
          thinking: streamThinking.value || null,
        })
      }
      streamText.value = ''
      streamThinking.value = ''
    }

    async function finishAgent() {
      if (streaming.value) {
        await abort()
      }
      try {
        await fetch(`${API}/opencode/editor-finish`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          credentials: 'include',
          body: JSON.stringify({ cwd: props.cwd }),
        })
      } catch (err) {
        console.error('Error al finalizar agente editor:', err)
      }
      agentActive.value = false
      ocSessionId.value = null
      messages.value = []
      input.value = ''
      error.value = ''
      streaming.value = false
      streamText.value = ''
      streamThinking.value = ''
    }

    function onTextareaKeydown(e) {
      if (e.key === 'Enter' && !e.shiftKey && !e.ctrlKey && !e.altKey && !e.metaKey) {
        e.preventDefault()
        send()
      }
    }

    function scrollToBottom() {
      nextTick(() => {
        const el = chatContainer.value
        if (el) el.scrollTop = el.scrollHeight
      })
    }

    watch(() => props.cwd, (newCwd) => {
      if (newCwd && !agentActive.value) {
        loadProviders()
      }
    })

    onMounted(() => {
      if (props.cwd) loadProviders()
    })

    return {
      provider, model, thinking, mode, temperature,
      providers, models, modelSupportsReasoning,
      thinkingOptions, temperatureOptions,
      agentActive, initializing, streaming,
      messages, input, error,
      streamText, streamThinking, streamThinkingOpen,
      thinkingOpen, chatContainer,
      initAgent, send, abort, finishAgent,
      toggleThinking, onTextareaKeydown,
    }
  },
}
</script>

<style scoped>
.file-editor-occhat {
  font-size: 0.75rem;
  color: #d1d5db;
  min-height: 0;
}
.chat-messages {
  background: #0d1117;
}
.msg-bubble {
  word-break: break-word;
  white-space: pre-wrap;
}
.msg-assistant {
  background: #1a1a2e !important;
}
.thinking-content {
  border-left: 2px solid #75AADB;
  font-family: monospace;
}
.streaming-cursor {
  animation: blink 1s step-end infinite;
  color: #75AADB;
}
@keyframes blink {
  50% { opacity: 0; }
}
</style>
