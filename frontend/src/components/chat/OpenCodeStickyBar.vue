<template>
  <div v-if="visible" class="border-top opencode-sticky-bar p-2" style="border-color: #75AADB; background: #0d1b2a;">
    <div class="d-flex gap-2 flex-wrap align-items-end">
      <div style="min-width: 150px; flex: 1;">
        <label class="small text-light-emphasis mb-1">Modelo</label>
        <select v-model="ocStore.selectedModel" class="form-select form-select-sm bg-dark text-light border-secondary font-monospace">
          <option value="" disabled>Selecciona modelo...</option>
          <option v-for="m in ocStore.getModelsForProvider(ocStore.selectedProvider)" :key="m.value" :value="m.value">{{ m.label }}</option>
        </select>
      </div>
      <div v-if="ocStore.modelSupportsReasoning(ocStore.selectedProvider, ocStore.selectedModel)" style="min-width: 140px; flex: 1;">
        <label class="small text-light-emphasis mb-1">Pensamiento</label>
        <select v-model="ocStore.selectedThinking" class="form-select form-select-sm bg-dark text-light border-secondary font-monospace">
          <option v-for="t in ocStore.thinkingOptions" :key="t.value" :value="t.value">{{ t.label }}</option>
        </select>
      </div>
      <div style="min-width: 120px; flex: 1;">
        <label class="small text-light-emphasis mb-1">Temp.</label>
        <select v-model="ocStore.selectedTemperature" class="form-select form-select-sm bg-dark text-light border-secondary font-monospace">
          <option v-for="t in ocStore.temperatureOptions" :key="t.value" :value="t.value">{{ t.label }}</option>
        </select>
      </div>
      <div style="min-width: 120px; flex: 1;">
        <label class="small text-light-emphasis mb-1">Modo</label>
        <div class="btn-group btn-group-sm w-100" role="group">
          <button type="button" class="btn btn-sm font-monospace" :class="ocStore.selectedMode === 'Plan' ? 'btn-warning' : 'btn-outline-secondary'" @click="ocStore.selectedMode = 'Plan'">Plan</button>
          <button type="button" class="btn btn-sm font-monospace" :class="ocStore.selectedMode === 'Build' ? 'btn-success' : 'btn-outline-secondary'" @click="ocStore.selectedMode = 'Build'">Build</button>
        </div>
      </div>
    </div>
    <div class="d-flex gap-2 mt-2">
      <div class="position-relative flex-grow-1">
        <textarea
          ref="ocTextarea"
          :value="ocInput"
          class="form-control form-control-sm bg-dark text-light border-secondary font-monospace w-100"
          rows="2"
          :placeholder="ocStreaming ? 'OpenCode está procesando...' : 'Escribe tu mensaje para OpenCode...'"
          :disabled="ocStreaming"
          style="resize: vertical; max-height: 120px;"
          @keydown="onOcTextareaKeydown"
          @input="onOcTextareaInput($event)"
          @click="onOcTextareaClick"
          @blur="onOcTextareaBlur"
        ></textarea>
        <VariableAutocomplete
          :show="ocAC.show"
          :items="ocAC.filteredVariables"
          :selected-index="ocAC.selectedIndex"
          @select="selectOcVariable"
          @update:selected-index="ocAC.selectedIndex = $event"
        />
      </div>
      <div class="d-flex flex-column gap-1 flex-shrink-0">
        <button class="btn btn-sm btn-success" :disabled="ocStreaming || !ocInput.trim()" @click="send">Enviar</button>
        <button class="btn btn-sm btn-outline-danger" @click="$emit('finish')">⏹ Finalizar</button>
      </div>
    </div>
  </div>
</template>

<script>
import { ref, reactive, computed, nextTick } from 'vue'
import { useOpencodeStore } from '../../stores/opencode.js'
import { useChatStore } from '../../stores/chat.js'
import { useProjectVariablesStore } from '../../stores/projectVariables.js'
import { useMustacheAutocomplete } from '../../composables/useMustacheAutocomplete.js'
import VariableAutocomplete from './VariableAutocomplete.vue'

export default {
  components: { VariableAutocomplete },
  props: {
    activeSessionId: { type: [Number, String], default: null },
    ocStreaming: { type: Boolean, default: false },
    ocInput: { type: String, default: '' },
  },
  emits: ['update:ocInput', 'send', 'finish'],
  setup(props, { emit }) {
    const ocStore = useOpencodeStore()
    const chat = useChatStore()
    const projectVarStore = useProjectVariablesStore()
    const ocTextarea = ref(null)
    const ocAC = reactive(useMustacheAutocomplete())

    async function onOcTextareaInput(e) {
      emit('update:ocInput', e.target.value)
      await nextTick()
      const ta = ocTextarea.value
      if (!ta) { ocAC.close(); return }
      const sid = props.activeSessionId
      if (!sid) { ocAC.close(); return }
      const session = chat.sessions.find(s => Number(s.id) === Number(sid))
      const pid = session?.proyecto_id
      if (!pid) { ocAC.close(); return }
      if (!projectVarStore.variablesByProject[pid]) {
        await projectVarStore.loadVariables(pid)
      }
      ocAC.update(props.ocInput, ta.selectionStart, projectVarStore.variablesByProject[pid] || [])
    }

    function onOcTextareaClick(e) {
      onOcTextareaInput(e)
    }

    function onOcTextareaBlur() {
      setTimeout(() => { ocAC.close() }, 200)
    }

    function onOcTextareaKeydown(e) {
      if (ocAC.show) {
        if (e.key === 'Enter' && !e.shiftKey) {
          e.preventDefault()
          const key = ocAC.getSelectedKey()
          if (key) selectOcVariable(key)
          return
        }
        if (e.key === 'ArrowDown') { e.preventDefault(); ocAC.navigate('down'); return }
        if (e.key === 'ArrowUp') { e.preventDefault(); ocAC.navigate('up'); return }
        if (e.key === 'Escape') { e.preventDefault(); ocAC.close(); return }
        if (e.key === 'Tab') {
          e.preventDefault()
          const key = ocAC.getSelectedKey()
          if (key) selectOcVariable(key)
          return
        }
        return
      }
      if (e.key === 'Enter' && !e.shiftKey && !e.ctrlKey && !e.altKey && !e.metaKey) {
        e.preventDefault()
        emit('send')
      }
    }

    function selectOcVariable(key) {
      const newText = ocAC.insert(key)
      if (newText !== null) {
        emit('update:ocInput', newText)
        nextTick(() => {
          const ta = ocTextarea.value
          if (ta) {
            const pos = ocAC.beforeOpen.length + key.length + 4
            ta.focus()
            ta.setSelectionRange(pos, pos)
          }
        })
      }
    }

    function send() {
      emit('send')
    }

    const visible = computed(() => {
      return ocStore.ocSessionId && ocStore.selectedProvider && props.activeSessionId && ocStore.chatSessionId && Number(props.activeSessionId) === Number(ocStore.chatSessionId)
    })

    return {
      ocStore, ocTextarea, ocAC, visible,
      onOcTextareaInput, onOcTextareaClick, onOcTextareaBlur, onOcTextareaKeydown,
      selectOcVariable, send,
    }
  },
}
</script>

<style scoped>
.opencode-sticky-bar {
  flex-shrink: 0;
  border-top-width: 1px;
  border-top-style: solid;
  box-shadow: 0 -2px 8px rgba(0, 0, 0, 0.3);
}

.opencode-sticky-bar select.form-select-sm,
.opencode-sticky-bar textarea {
  font-size: 0.8rem;
}

.opencode-sticky-bar .btn-group .btn-sm {
  font-size: 0.75rem;
}
</style>
