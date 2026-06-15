<template>
  <div class="d-flex flex-column h-100">
    <div class="flex-grow-1 overflow-auto p-3" ref="messagesContainer">
      <div v-if="!activeSessionId" class="text-center text-muted mt-5">
        <h5>Selecciona o crea un nuevo chat</h5>
      </div>
      <template v-else>
        <ChatMessage v-for="m in messages" :key="m.id || m._key" :msg="m" />
        <!-- Streaming message -->
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
import ChatMessage from './ChatMessage.vue'

export default {
  components: { ChatMessage },
  setup() {
    const chat = useChatStore()
    const { activeSessionId, messages, streaming, currentChunk, currentThinking } = storeToRefs(chat)
    const input = ref('')
    const messagesContainer = ref(null)

    function send() {
      if (!input.value.trim() || !chat.activeSessionId) return
      chat.sendMessage(chat.activeSessionId, input.value)
      input.value = ''
    }

    watch(
      () => [chat.messages.length, chat.currentChunk],
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
      input,
      send,
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
