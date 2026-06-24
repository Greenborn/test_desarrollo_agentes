<template>
  <div class="d-flex flex-column gap-2">
    <div
      v-for="w in workspaces"
      :key="w.id"
    >
      <button
        class="btn w-100 text-start d-flex align-items-center justify-content-between"
        :class="w.id === currentWorkspaceId ? 'btn-secondary' : 'btn-outline-argentina'"
        :disabled="w.id === currentWorkspaceId || switching"
        @click="switchTo(w.id)"
      >
        <span>{{ w.name }}</span>
        <span v-if="w.id === currentWorkspaceId" class="badge bg-info ms-2">Actual</span>
      </button>
    </div>
    <div v-if="workspaces.length === 0" class="text-muted text-center small py-3">
      No hay espacios de trabajo adicionales.
    </div>
    <div v-if="switching" class="text-center text-info small mt-2">
      Cambiando espacio de trabajo...
    </div>
  </div>
</template>

<script>
import { ref, computed } from 'vue'
import { storeToRefs } from 'pinia'
import { useWorkspaceStore } from '../stores/workspace.js'
import { useAuthStore } from '../stores/auth.js'
import { useChatStore } from '../stores/chat.js'

export default {
  emits: ['close'],
  setup(props, { emit }) {
    const wsStore = useWorkspaceStore()
    const auth = useAuthStore()
    const chatStore = useChatStore()
    const { workspaces } = storeToRefs(wsStore)
    const switching = ref(false)

    const currentWorkspaceId = computed(() => auth.getWorkspaceId())

    async function switchTo(id) {
      if (id === currentWorkspaceId.value) return

      const hasProcesses = chatStore.executing || chatStore.streaming
      if (hasProcesses) {
        const confirmed = confirm('Se detendrán todos los procesos en ejecución. ¿Desea cambiar de espacio de trabajo?')
        if (!confirmed) return
      }

      switching.value = true
      const result = await wsStore.selectWorkspace(id)
      if (result.success) {
        auth.setWorkspaceId(id)
        chatStore.stopAllExecutions()
        await wsStore.loadWorkspaces()
        emit('close')
      } else {
        switching.value = false
      }
    }

    return { workspaces, currentWorkspaceId, switching, switchTo }
  },
}
</script>
