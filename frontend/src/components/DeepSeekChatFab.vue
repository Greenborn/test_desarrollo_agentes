<template>
  <div class="fab-wrapper">
    <Transition name="fab-bubble">
      <div v-if="open" class="fab-bubble">
        <div class="fab-bubble-header d-flex justify-content-between align-items-center px-3 py-2">
          <span class="small fw-semibold" style="color: #e0e0e0;">Chat DeepSeek</span>
          <button class="btn btn-sm p-0 border-0" style="color: #9ca3af; line-height: 1;" @click="close" title="Cerrar">&times;</button>
        </div>
        <div class="fab-bubble-body px-3 py-2">
          <textarea
            ref="textareaRef"
            v-model="text"
            class="form-control bg-dark text-light border-secondary font-monospace"
            rows="4"
            placeholder="Escribe tu mensaje... (Enter para enviar)"
            @keydown.enter.exact.prevent="send"
            @input="onInput"
          ></textarea>
        </div>
        <div class="fab-bubble-footer d-flex justify-content-end gap-2 px-3 py-2">
          <button class="btn btn-sm btn-outline-secondary" @click="close">Cancelar</button>
          <button class="btn btn-sm btn-argentina" :disabled="!text.trim()" @click="send">Enviar</button>
        </div>
      </div>
    </Transition>
    <button
      class="fab-btn"
      :class="{ active: open }"
      @click="toggle"
      :title="open ? 'Cerrar chat' : 'Abrir chat DeepSeek'"
    >
      <span v-if="!open">💬</span>
      <span v-else>&times;</span>
    </button>
  </div>
</template>

<script>
import { ref, watch, nextTick, onUnmounted } from 'vue'

const DRAFT_KEY = 'ds_fab_draft'

export default {
  props: {
    activeSessionId: { type: [String, Number], default: null },
  },
  emits: ['send'],
  setup(props, { emit }) {
    const open = ref(false)
    const text = ref('')
    const textareaRef = ref(null)

    function draftKey() {
      return props.activeSessionId ? DRAFT_KEY + '_' + props.activeSessionId : DRAFT_KEY
    }

    function loadDraft() {
      try {
        const saved = localStorage.getItem(draftKey())
        if (saved) text.value = saved
      } catch (e) {
        console.error('Error loading draft:', e.message)
      }
    }

    function saveDraft() {
      try {
        if (text.value) {
          localStorage.setItem(draftKey(), text.value)
        } else {
          localStorage.removeItem(draftKey())
        }
      } catch (e) {
        console.error('Error saving draft:', e.message)
      }
    }

    function clearDraft() {
      try {
        localStorage.removeItem(draftKey())
      } catch (e) {
        console.error('Error clearing draft:', e.message)
      }
    }

    function onInput() {
      saveDraft()
    }

    function toggle() {
      open.value = !open.value
      if (open.value) {
        loadDraft()
        nextTick(() => {
          textareaRef.value?.focus()
          textareaRef.value?.setSelectionRange(text.value.length, text.value.length)
        })
      }
    }

    function send() {
      const raw = text.value.trim()
      if (!raw) return
      clearDraft()
      text.value = ''
      open.value = false
      emit('send', raw)
    }

    function close() {
      open.value = false
    }

    function onKeydown(e) {
      if (e.key === 'Escape' && open.value) {
        close()
      }
    }

    watch(() => props.activeSessionId, () => {
      if (open.value) {
        loadDraft()
      }
    })

    if (typeof window !== 'undefined') {
      window.addEventListener('keydown', onKeydown)
    }
    onUnmounted(() => {
      if (typeof window !== 'undefined') {
        window.removeEventListener('keydown', onKeydown)
      }
    })

    return { open, text, textareaRef, toggle, send, close, onInput }
  },
}
</script>

<style scoped>
.fab-wrapper {
  position: fixed;
  bottom: 24px;
  right: 24px;
  z-index: 1050;
  display: flex;
  flex-direction: column;
  align-items: flex-end;
}

.fab-btn {
  width: 52px;
  height: 52px;
  border-radius: 50%;
  border: 1px solid #75AADB;
  background: #1a2744;
  color: #75AADB;
  font-size: 1.4rem;
  cursor: pointer;
  display: flex;
  align-items: center;
  justify-content: center;
  box-shadow: 0 4px 14px rgba(0, 0, 0, 0.4);
  transition: background 0.15s, transform 0.15s;
}

.fab-btn:hover {
  background: #1a2a4e;
  transform: scale(1.05);
}

.fab-btn.active {
  background: #2a3a5e;
}

.fab-bubble {
  position: absolute;
  bottom: 60px;
  right: 0;
  width: 360px;
  max-width: calc(100vw - 48px);
  background: #16213e;
  border: 1px solid #374151;
  border-radius: 12px;
  box-shadow: 0 8px 24px rgba(0, 0, 0, 0.5);
  overflow: hidden;
}

.fab-bubble-header {
  border-bottom: 1px solid #374151;
}

.fab-bubble-body textarea {
  resize: none;
  font-size: 0.85rem;
}

.fab-bubble-footer {
  border-top: 1px solid #374151;
}

.fab-bubble-enter-active {
  transition: opacity 0.15s ease, transform 0.15s ease;
}

.fab-bubble-leave-active {
  transition: opacity 0.1s ease, transform 0.1s ease;
}

.fab-bubble-enter-from,
.fab-bubble-leave-to {
  opacity: 0;
  transform: translateY(8px) scale(0.96);
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
</style>
