<template>
  <div class="proyectos-panel d-flex flex-column flex-grow-1 h-100" style="min-height: 0;">
    <div class="px-3 py-2 flex-shrink-0 d-flex flex-row gap-2">
      <select
        v-model="selectedWsFilter"
        class="form-select form-select-sm flex-shrink-0"
        style="width: auto; min-width: 120px; background: #0d1117; border-color: #374151; color: #e0e0e0; font-size: 0.75rem;"
      >
        <option value="">Todos</option>
        <option v-for="ws in workspaceStore.workspaces" :key="ws.id" :value="ws.id">
          {{ ws.name }}
        </option>
      </select>
      <input
        v-model="projectFilter"
        type="text"
        class="form-control form-control-sm flex-grow-1"
        placeholder="Buscar proyectos..."
        style="background: #0d1117; border-color: #374151; color: #e0e0e0; font-size: 0.75rem;"
      />
    </div>
    <div class="overflow-y-auto flex-grow-1 px-2 pb-2">
      <div
        v-for="p in filteredProjects"
        :key="p.id"
        class="project-item d-flex align-items-center px-2 py-1 mb-1 rounded"
        :class="{ selected: selectedProject?.id === p.id }"
        @click="selectProject(p)"
      >
        <span class="ms-1 text-truncate">{{ p.id }} — {{ p.descripcion }}</span>
      </div>
      <div v-if="filteredProjects.length === 0" class="text-muted small text-center py-4">
        No hay proyectos
      </div>
    </div>
  </div>
</template>

<script>
import { ref, computed, watch, onMounted, onUnmounted } from 'vue'
import { storeToRefs } from 'pinia'
import { useProjectStore } from '../../../stores/project.js'
import { useWorkspaceStore } from '../../../stores/workspace.js'
import { useChatStore } from '../../../stores/chat.js'

export default {
  setup() {
    const projectStore = useProjectStore()
    const workspaceStore = useWorkspaceStore()
    const chatStore = useChatStore()
    const { projects, selectedProject } = storeToRefs(projectStore)
    const { activeSessionId, sessions } = storeToRefs(chatStore)
    const projectFilter = ref('')
    const selectedWsFilter = ref('')

    function syncWsFilter() {
      const s = sessions.value.find(s => s.id === activeSessionId.value)
      if (s?.workspace_id && workspaceStore.workspaces.some(w => w.id === s.workspace_id)) {
        selectedWsFilter.value = s.workspace_id
      } else if (workspaceStore.workspaces.length > 0) {
        selectedWsFilter.value = workspaceStore.workspaces[0].id
      }
    }

    onMounted(() => {
      if (workspaceStore.workspaces.length === 0) {
        workspaceStore.loadWorkspaces().then(syncWsFilter)
      } else {
        syncWsFilter()
      }
    })

    const unsubscribe = watch(activeSessionId, () => {
      syncWsFilter()
    })

    onUnmounted(() => {
      unsubscribe()
    })

    const filteredProjects = computed(() => {
      let list = projects.value
      if (selectedWsFilter.value) {
        list = list.filter(p => p.workspace_id === selectedWsFilter.value)
      }
      const filter = projectFilter.value.toLowerCase().trim()
      if (!filter) return list
      return list.filter(p => {
        const id = (p.id || '').toLowerCase()
        const desc = (p.descripcion || '').toLowerCase()
        return id.includes(filter) || desc.includes(filter)
      })
    })

    function selectProject(p) {
      projectStore.selectProject(p)
    }

    return {
      projectStore,
      workspaceStore,
      selectedProject,
      projectFilter,
      selectedWsFilter,
      filteredProjects,
      selectProject,
    }
  },
}
</script>

<style scoped>
.proyectos-panel {
  background: #16213e;
}
.project-item {
  cursor: pointer;
  color: #cbd5e1;
  font-size: 0.75rem;
  transition: background 0.15s;
}
.project-item:hover {
  background: rgba(117, 170, 219, 0.1);
}
.project-item.selected {
  background: rgba(117, 170, 219, 0.18);
  color: #75AADB;
  border-left: 3px solid #75AADB;
}

</style>
