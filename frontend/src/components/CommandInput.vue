<template>
  <div class="position-relative flex-grow-1 mx-3" style="max-width: 480px;">
    <div class="input-group input-group-sm">
      <span class="input-group-text bg-dark text-success border-secondary font-monospace text-truncate" style="max-width: 180px;" :title="currentDir || '/'">
        {{ (currentDir || '/') }} $
      </span>
      <input
        ref="inputEl"
        v-model="buffer"
        type="text"
        class="form-control form-control-sm bg-dark text-light border-secondary font-monospace"
        placeholder="Escribe /help para ayuda"
        @keydown.enter="handleEnter"
        @keydown.tab.prevent="handleTab"
        @keydown.up.prevent="handleUp"
        @keydown.down.prevent="handleDown"
        @keydown.escape="hideAutocomplete"
        @input="onInput"
      />
    </div>
    <div
      v-if="autocompleteVisible"
      class="position-absolute top-100 start-0 end-0 bg-dark border border-secondary rounded-bottom"
      style="z-index: 1050; max-height: 200px; overflow-y: auto;"
    >
      <button
        v-for="(opt, i) in autocompleteOptions"
        :key="opt"
        class="d-block w-100 text-start px-2 py-1 btn btn-sm text-light font-monospace"
        :class="{ 'bg-primary': i === arrowIndex }"
        @mousedown.prevent="pickAutocomplete(opt)"
        @mouseenter="arrowIndex = i"
      >
        {{ opt }}
      </button>
    </div>
  </div>
</template>

<script>
import { ref, nextTick } from 'vue'
import { storeToRefs } from 'pinia'
import { useCommandStore } from '../stores/command.js'
import { useCommandRegistry } from '../composables/useCommandRegistry.js'
import { useChatStore } from '../stores/chat.js'

export default {
  setup() {
    const cmdStore = useCommandStore()
    const chatStore = useChatStore()
    const { find, suggest } = useCommandRegistry()
    const { autocompleteOptions, autocompleteVisible, arrowIndex, currentDir } = storeToRefs(cmdStore)
    const buffer = ref('')
    const inputEl = ref(null)
    const historyIdx = ref(-1)

    function handleEnter() {
      if (autocompleteVisible.value && arrowIndex.value >= 0 && arrowIndex.value < autocompleteOptions.value.length) {
        pickAutocomplete(autocompleteOptions.value[arrowIndex.value])
        return
      }
      submit()
    }

    function submit() {
      const raw = buffer.value.trim()
      if (!raw) return
      buffer.value = ''
      historyIdx.value = -1
      cmdStore.pushHistory(raw)
      cmdStore.hideAutocomplete()
      execute(raw)
    }

    async function execute(raw) {
      let sessionId = chatStore.activeSessionId
      if (!sessionId) {
        sessionId = await chatStore.createSessionIfNeeded(cmdStore.currentDir)
        if (!sessionId) return
      }

      const parts = raw.split(/\s+/)
      const cmdName = parts[0].toLowerCase()
      const args = parts.slice(1)

      const known = find(cmdName)
      if (known) {
        known.execute(args, { cmdStore, chatStore })
      } else if (cmdName.startsWith('/')) {
        try {
          const res = await fetch('/api/command/execute', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            credentials: 'include',
            body: JSON.stringify({ command: raw, sessionId }),
          })
          const data = await res.json()
          if (data.success) {
            chatStore.loadMessages(sessionId)
          } else {
            console.error('Error al ejecutar comando:', data.result)
          }
        } catch (err) {
          console.error('Error al ejecutar comando:', err)
        }
      }
    }

    function handleUp() {
      if (autocompleteVisible.value && autocompleteOptions.value.length > 0) {
        arrowIndex.value = arrowIndex.value <= 0 ? autocompleteOptions.value.length - 1 : arrowIndex.value - 1
      } else {
        navHistory(-1)
      }
    }

    function handleDown() {
      if (autocompleteVisible.value && autocompleteOptions.value.length > 0) {
        arrowIndex.value = (arrowIndex.value + 1) % autocompleteOptions.value.length
      } else {
        navHistory(1)
      }
    }

    function navHistory(dir) {
      const h = cmdStore.sessionHistory
      if (!h.length) return
      historyIdx.value += dir
      if (historyIdx.value < -1) historyIdx.value = -1
      if (historyIdx.value >= h.length) historyIdx.value = h.length - 1
      buffer.value = historyIdx.value >= 0 ? h[historyIdx.value] : ''
    }

    async function handleTab() {
      const trimmed = buffer.value.trim()
      const parts = buffer.value.split(/\s+/)

      if (!trimmed) {
        cmdStore.showAutocomplete(suggest(''))
        return
      }

      const cmdName = parts[0].toLowerCase()
      const known = find(cmdName)

      if (known) {
        if (known.autocomplete) {
          const args = parts.slice(1)
          await known.autocomplete(args, cmdStore)
        } else {
          cmdStore.hideAutocomplete()
        }
      } else if (trimmed.startsWith('/')) {
        cmdStore.showAutocomplete(suggest(trimmed))
      } else {
        cmdStore.hideAutocomplete()
      }
    }

    function pickAutocomplete(dir) {
      const parts = buffer.value.split(/\s+/)
      const isCommand = dir.startsWith('/') && parts.length === 1
      if (isCommand) {
        buffer.value = dir + ' '
      } else {
        parts[parts.length - 1] = dir
        buffer.value = parts.join(' ') + ' '
      }
      cmdStore.hideAutocomplete()
      nextTick(() => inputEl.value?.focus())
    }

    function hideAutocomplete() {
      cmdStore.hideAutocomplete()
    }

    function onInput() {
      cmdStore.hideAutocomplete()
    }

    return {
      buffer, inputEl, autocompleteOptions,
      autocompleteVisible, arrowIndex, currentDir,
      handleEnter, handleTab, handleUp, handleDown,
      hideAutocomplete, pickAutocomplete, onInput,
    }
  },
}
</script>
