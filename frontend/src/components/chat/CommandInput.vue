<template>
  <div ref="rootEl" class="position-relative flex-grow-1 mx-3">
    <div class="input-group input-group-sm">
      <span class="input-group-text bg-dark text-success border-secondary font-monospace" :title="currentDir || '/'">
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
        @keyup="onKeyup"
        @input="onInput"
      />
    </div>
    <div
      ref="autocompleteList"
      v-if="autocompleteVisible"
      class="position-absolute top-100 start-0 end-0 bg-dark border border-secondary rounded-bottom"
      style="z-index: 1050; max-height: 200px; overflow-y: auto;"
    >
      <button
        v-for="(opt, i) in autocompleteOptions"
        :key="i"
        class="d-block w-100 text-start px-2 py-1 btn btn-sm text-light font-monospace"
        :class="{ 'bg-primary': i === arrowIndex }"
        @mousedown.prevent="pickAutocomplete(opt)"
        @mouseenter="arrowIndex = i"
      >
        {{ opt.display || opt }}
      </button>
    </div>
  </div>
</template>

<script>
import { ref, computed, nextTick, watch, onMounted, onUnmounted } from 'vue'
import { storeToRefs } from 'pinia'
import { useCommandStore } from '../../stores/command.js'
import { useCommandRegistry } from '../../composables/useCommandRegistry.js'
import { splitArgs } from '../../composables/parseCommandArgs.js'
import { useChatStore } from '../../stores/chat.js'
import { useUiStore } from '../../stores/ui.js'
import { useSettingsStore } from '../../stores/settings.js'
import { useProjectStore } from '../../stores/project.js'
import { useGitStore } from '../../stores/git.js'

export default {
  setup() {
    const cmdStore = useCommandStore()
    const chatStore = useChatStore()
    const uiStore = useUiStore()
    const settingsStore = useSettingsStore()
    const projectStore = useProjectStore()
    const gitStore = useGitStore()
    const { find, suggest } = useCommandRegistry()
    const { autocompleteOptions, autocompleteVisible, arrowIndex, currentDir } = storeToRefs(cmdStore)
    const { activeSessionId } = storeToRefs(chatStore)
    const buffer = ref('')
    const inputEl = ref(null)
    const autocompleteList = ref(null)
    const rootEl = ref(null)
    const historyIdx = ref(-1)
    let debounceTimer = null

    const fullHistory = computed(() => {
      const db = cmdStore.dbHistory || []
      const session = cmdStore.sessionHistory || []
      const seen = new Set()
      const result = []
      for (const cmd of session) {
        if (!seen.has(cmd)) { result.push(cmd); seen.add(cmd) }
      }
      for (let i = db.length - 1; i >= 0; i--) {
        if (!seen.has(db[i])) { result.push(db[i]); seen.add(db[i]) }
      }
      return result
    })

    watch(arrowIndex, (newIdx) => {
      if (newIdx >= 0 && autocompleteList.value) {
        nextTick(() => {
          const el = autocompleteList.value?.children[newIdx]
          if (el) el.scrollIntoView({ block: 'nearest' })
        })
      }
    })

    function handleEnter() {
      if (autocompleteVisible.value && autocompleteOptions.value.length > 0) {
        const idx = arrowIndex.value >= 0 ? arrowIndex.value : 0
        pickAutocomplete(autocompleteOptions.value[idx])
        return
      }
      submit()
    }

    function clearOmnifilterDebounce() {
      if (debounceTimer) {
        clearTimeout(debounceTimer)
        debounceTimer = null
      }
    }

    function submit() {
      const raw = buffer.value.trim()
      buffer.value = ''
      historyIdx.value = -1
      clearOmnifilterDebounce()

      if (!raw) {
        cmdStore.hideAutocomplete()
        uiStore.setOmnifilter('')
        return
      }

      cmdStore.pushHistory(raw)
      cmdStore.hideAutocomplete()

      if (raw.startsWith('/')) {
        uiStore.setOmnifilter('')
        execute(raw)
        cmdStore.loadHistory(chatStore.activeSessionId)
      } else {
        uiStore.setOmnifilter(raw)
      }
    }

    async function execute(raw) {
      let sessionId = chatStore.activeSessionId
      if (!sessionId) {
        sessionId = await chatStore.createSessionIfNeeded(cmdStore.currentDir)
        if (!sessionId) return
      }

      const parts = splitArgs(raw)
      const cmdName = parts[0].toLowerCase()

      const known = find(cmdName)

      try {
        await chatStore.runCommand(raw, async (loadingIdx, sid) => {
          if (known) {
            return known.execute(parts.slice(1), { cmdStore, chatStore, projectStore, loadingIdx, sessionId: sid })
          }
          if (!cmdName.startsWith('/')) return null
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
        gitStore.fetchGitBranch(sessionId)
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
      const h = fullHistory.value
      if (!h.length) return
      historyIdx.value -= dir
      if (historyIdx.value < -1) historyIdx.value = -1
      if (historyIdx.value >= h.length) historyIdx.value = h.length - 1
      buffer.value = historyIdx.value >= 0 ? h[historyIdx.value] : ''
    }

    async function handleTab() {
      if (autocompleteVisible.value && autocompleteOptions.value.length > 0) {
        const idx = arrowIndex.value >= 0 ? arrowIndex.value : 0
        pickAutocomplete(autocompleteOptions.value[idx])
        return
      }

      cmdStore.hideAutocomplete()

      const trimmed = buffer.value.trim()
      const parts = splitArgs(buffer.value)

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

    function pickAutocomplete(opt) {
      const value = typeof opt === 'object' ? opt.value : opt
      const parts = splitArgs(buffer.value)
      const isCommand = value.startsWith('/') && parts.length === 1
      if (isCommand) {
        buffer.value = value + ' '
      } else if (value.startsWith('--') && parts.length === 1 && parts[0].startsWith('/')) {
        buffer.value = parts[0] + ' ' + value + ' '
      } else {
        parts[parts.length - 1] = value
        buffer.value = parts.join(' ') + ' '
      }
      cmdStore.hideAutocomplete()
      nextTick(() => inputEl.value?.focus())
    }

    function hideAutocomplete() {
      cmdStore.hideAutocomplete()
    }

    function onClickOutside(event) {
      if (autocompleteVisible.value && rootEl.value && !rootEl.value.contains(event.target)) {
        cmdStore.hideAutocomplete()
      }
    }

    function onInput() {
      cmdStore.hideAutocomplete()
    }

    function onKeyup() {
      clearOmnifilterDebounce()

      const text = buffer.value.trim()
      if (text.startsWith('/')) {
        uiStore.setOmnifilter('')
        return
      }

      const delay = settingsStore.omnifilterDebounceMs || 2000
      debounceTimer = setTimeout(() => {
        uiStore.setOmnifilter(text)
      }, delay)
    }

    onMounted(() => {
      cmdStore.loadHistory(chatStore.activeSessionId)
      document.addEventListener('mousedown', onClickOutside)
    })

    onUnmounted(() => {
      clearOmnifilterDebounce()
      document.removeEventListener('mousedown', onClickOutside)
    })

    watch(activeSessionId, (newId) => {
      cmdStore.loadHistory(newId)
    })

    return {
      buffer, inputEl, autocompleteList, rootEl, autocompleteOptions,
      autocompleteVisible, arrowIndex, currentDir,
      handleEnter, handleTab, handleUp, handleDown,
      hideAutocomplete, pickAutocomplete, onInput, onKeyup,
    }
  },
}
</script>
