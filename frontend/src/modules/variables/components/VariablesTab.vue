<template>
  <div v-if="!activeSession" class="d-flex flex-column align-items-center justify-content-center flex-grow-1 text-secondary small px-3 text-center">
    <span>Seleccione una sesión de chat</span>
  </div>
  <div v-else-if="!proyectoId" class="d-flex flex-column align-items-center justify-content-center flex-grow-1 text-secondary small px-3 text-center">
    <span>Sin proyecto asignado a esta sesión</span>
  </div>
  <div v-else-if="loadingVariables" class="d-flex flex-column align-items-center justify-content-center flex-grow-1 text-secondary small">
    <span>Cargando variables…</span>
  </div>
  <div v-else-if="variables.length === 0" class="d-flex flex-column align-items-center justify-content-center flex-grow-1 text-secondary small px-3 text-center">
    <span>No hay variables definidas para este proyecto</span>
    <button class="btn btn-sm btn-outline-argentina mt-2" style="font-size: 0.7rem;" @click.stop="agregarVariable">+ Agregar variable</button>
  </div>
  <div v-else class="variables-list flex-grow-1 overflow-y-auto px-2 py-1">
    <button class="btn btn-sm btn-outline-argentina w-100 mb-2" style="font-size: 0.7rem;" @click.stop="agregarVariable">+ Agregar variable</button>
    <div v-for="v in variables" :key="v.key" class="variable-item d-flex align-items-start px-2 py-2 mb-1 rounded"
      @click="openVariableDetail(v)" role="button">
      <span class="variable-key text-nowrap">{{ v.key }}</span>
      <span class="variable-sep mx-1 text-muted">=</span>
      <span class="variable-value small">{{ truncateValue(v.value) }}</span>
      <span v-if="v.type === 'memory'" class="badge bg-info ms-1" style="font-size: 0.55rem; line-height: 1.2; align-self: center;">mem</span>
      <button class="variable-copy-btn" title="Copiar {{key}}" @click.stop="copiarKey(v.key)">📋</button>
    </div>
  </div>
</template>

<script>
import { watch, computed } from 'vue'
import { storeToRefs } from 'pinia'
import { useChatStore } from '../../../stores/chat.js'
import { useProjectVariablesStore } from '../../../stores/projectVariables.js'
import { useModalStore } from '../../../stores/modal.js'
import VariableDetailModal from '../../../components/modals/VariableDetailModal.vue'
import CreateVariableModal from '../../../components/modals/CreateVariableModal.vue'

export default {
  setup() {
    const chat = useChatStore()
    const modal = useModalStore()
    const projectVariables = useProjectVariablesStore()
    const { activeSessionId, sessions } = storeToRefs(chat)

    const activeSession = computed(() => {
      return sessions.value.find(s => s.id === activeSessionId.value) || null
    })

    const proyectoId = computed(() => activeSession.value?.proyecto_id || null)

    const variables = computed(() => projectVariables.variablesByProject[proyectoId.value] || [])
    const loadingVariables = computed(() => projectVariables.loadingByProject[proyectoId.value] || false)

    function truncateValue(val) {
      if (!val) return ''
      const str = String(val)
      return str.length > 50 ? str.substring(0, 50) + '…' : str
    }

    function openVariableDetail(variable) {
      modal.open(VariableDetailModal, { variable }, { title: variable.key })
    }

    function copiarKey(key) {
      navigator.clipboard.writeText('{{' + key + '}}').catch(err => {
        console.error('Error al copiar key:', err)
      })
    }

    function agregarVariable() {
      modal.open(CreateVariableModal, {}, { title: 'Nueva Variable' })
    }

    watch(proyectoId, (newId) => {
      if (!newId) {
        projectVariables.clearVariables()
        return
      }
      projectVariables.loadVariables(newId)
    }, { immediate: true })

    return {
      activeSession,
      proyectoId,
      variables,
      loadingVariables,
      truncateValue,
      openVariableDetail,
      copiarKey,
      agregarVariable,
    }
  },
}
</script>

<style scoped>
.variables-list {
  background: #16213e;
}
.variable-item {
  background: #1a2744;
  border: 1px solid #374151;
  cursor: pointer;
  position: relative;
}
.variable-item:hover {
  background: #1e3050;
}
.variable-copy-btn {
  position: absolute;
  left: 2px;
  top: 50%;
  transform: translateY(-50%);
  background: none;
  border: none;
  font-size: 0.6rem;
  cursor: pointer;
  padding: 2px 6px;
  border-radius: 3px;
  line-height: 1.2;
  color: #6b7280;
  opacity: 0;
  transition: opacity 0.15s, color 0.15s, background 0.15s;
  flex-shrink: 0;
  z-index: 2;
}
.variable-item:hover .variable-copy-btn {
  opacity: 1;
}
.variable-copy-btn:hover {
  color: #75AADB;
  background: rgba(117, 170, 219, 0.12);
}
.variable-key {
  color: #75AADB;
  font-size: 0.75rem;
  font-family: monospace;
  font-weight: 600;
  flex-shrink: 0;
}
.variable-value {
  color: #cbd5e1;
  font-family: monospace;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
  min-width: 0;
  line-height: 1.4;
}
.variable-sep {
  font-family: monospace;
  font-size: 0.75rem;
}
</style>
