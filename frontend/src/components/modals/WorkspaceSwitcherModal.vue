<template>
  <div class="d-flex flex-column gap-2">
    <div
      v-for="w in workspaces"
      :key="w.id"
      class="d-flex align-items-center gap-2 px-2 py-1 rounded"
    >
      <input
        type="checkbox"
        :value="w.id"
        :checked="isSelected(w.id)"
        @change="toggleWorkspace(w.id)"
        class="form-check-input"
      />
      <span class="flex-grow-1">{{ w.name }}</span>
    </div>
    <div v-if="workspaces.length === 0" class="text-muted text-center small py-3">
      No hay espacios de trabajo adicionales.
    </div>
    <div class="d-flex gap-2 mt-2">
      <button class="btn btn-argentina flex-grow-1" :disabled="saving" @click="applySelection">
        {{ saving ? 'Guardando...' : 'Aplicar' }}
      </button>
    </div>
    <div v-if="saving" class="text-center text-info small mt-1">
      Actualizando espacios de trabajo...
    </div>
  </div>
</template>

<script>
import { ref } from 'vue'
import { storeToRefs } from 'pinia'
import { useModalStore } from '../../stores/modal.js'
import { useWorkspaceStore } from '../../stores/workspace.js'
import { useAuthStore } from '../../stores/auth.js'
import { useChatStore } from '../../stores/chat.js'
import AlertModal from '../modals/AlertModal.vue'

export default {
  emits: ['close'],
  setup(props, { emit }) {
    const wsStore = useWorkspaceStore()
    const modal = useModalStore()
    const auth = useAuthStore()
    const chatStore = useChatStore()
    const { workspaces } = storeToRefs(wsStore)
    const saving = ref(false)

    const selected = ref([...auth.getWorkspaceIds()])

    function isSelected(id) {
      return selected.value.includes(id)
    }

    function toggleWorkspace(id) {
      const idx = selected.value.indexOf(id)
      if (idx >= 0) {
        selected.value.splice(idx, 1)
      } else {
        selected.value.push(id)
      }
    }

    async function applySelection() {
      let ids = [...selected.value]
      if (ids.length === 0) {
        modal.open(AlertModal, { message: 'Debe seleccionar al menos un espacio de trabajo.' }, { title: 'Aviso' })
        return
      }

      const hasProcesses = chatStore.executing || chatStore.streaming
      if (hasProcesses && ids.length !== auth.getWorkspaceIds().length) {
        const confirmed = confirm('Se detendrán todos los procesos en ejecución. ¿Desea cambiar los espacios de trabajo?')
        if (!confirmed) return
      }

      saving.value = true
      const result = await wsStore.selectWorkspaces(ids)
      if (result.success) {
        auth.setWorkspaceIds(result.workspaceIds)
        chatStore.stopAllExecutions()
        await wsStore.loadWorkspaces()
        emit('close')
      }
      saving.value = false
    }

    return { workspaces, selected, saving, isSelected, toggleWorkspace, applySelection }
  },
}
</script>
