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
    </div>
    <div class="flex-grow-1" style="min-height: 0;">
      <TableEditor
        id="proyectos"
        :data="tableData"
        :config="{
          selectionMode: 'single',
          hideRefresh: true,
          hideCsvExport: true,
          showPaginator: false,
          striped: true,
          scrollHeight: '100%',
          pageSize: 200,
          preferencesStore: createPiniaPrefsAdapter(),
        }"
        @rowSelected="onRowSelected"
      />
    </div>
  </div>
</template>

<script>
import { ref, computed, watch, onMounted, onUnmounted } from 'vue'
import { storeToRefs } from 'pinia'
import { useProjectStore } from '../../../stores/project.js'
import { useWorkspaceStore } from '../../../stores/workspace.js'
import { useChatStore } from '../../../stores/chat.js'
import { TableEditor } from 'vue-table-editor'
import { createPiniaPrefsAdapter } from '../../../components/TableEditor/preferenciasAdapter.js'

export default {
  components: { TableEditor },
  setup() {
    const projectStore = useProjectStore()
    const workspaceStore = useWorkspaceStore()
    const chatStore = useChatStore()
    const { projects, selectedProject } = storeToRefs(projectStore)
    const { activeSessionId, sessions } = storeToRefs(chatStore)
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
      let list = projects.value || []
      if (selectedWsFilter.value) {
        list = list.filter(p => p.workspace_id === selectedWsFilter.value)
      }
      return list
    })

    const tableData = computed(() => ({
      fields_def: [
        { field: 'id', headerName: 'ID' },
        { field: 'descripcion', headerName: 'Descripción' },
        { field: 'workspace_id', headerName: 'Workspace' },
      ],
      rows: filteredProjects.value.map(p => ({
        id: p.id,
        descripcion: p.descripcion,
        workspace_id: p.workspace_id,
      })),
    }))

    function onRowSelected(row) {
      if (row) {
        const p = projects.value.find(pr => pr.id === row.id)
        if (p) projectStore.selectProject(p)
      }
    }

    return {
      workspaceStore,
      selectedProject,
      selectedWsFilter,
      filteredProjects,
      tableData,
      onRowSelected,
      createPiniaPrefsAdapter,
    }
  },
}
</script>

<style scoped>
.proyectos-panel {
  background: #16213e;
}
</style>
