<template>
  <div class="proyectos-panel d-flex flex-column flex-grow-1 h-100" style="min-height: 0;">
    <div class="px-3 py-2 flex-shrink-0">
      <input
        v-model="projectFilter"
        type="text"
        class="form-control form-control-sm"
        placeholder="Buscar proyectos..."
        style="background: #0d1117; border-color: #374151; color: #e0e0e0; font-size: 0.75rem;"
      />
    </div>
    <div class="overflow-y-auto flex-grow-1 px-2 pb-2">
      <div
        v-for="p in filteredProjects"
        :key="p.id"
        class="project-item d-flex align-items-center px-2 py-1 mb-1 rounded"
        :class="{ selected: selectedProject?.id === p.id, pinned: pinnedProjectId === p.id }"
        @click="selectProject(p)"
      >
        <span
          class="pin-btn"
          :class="{ pinned: pinnedProjectId === p.id }"
          @click.stop="projectStore.togglePin(p.id)"
          title="Fijar proyecto"
        >📌</span>
        <span class="ms-1 text-truncate">{{ p.id }} — {{ p.descripcion }}</span>
      </div>
      <div v-if="filteredProjects.length === 0" class="text-muted small text-center py-4">
        No hay proyectos
      </div>
    </div>
  </div>
</template>

<script>
import { ref, computed } from 'vue'
import { storeToRefs } from 'pinia'
import { useProjectStore } from '../../../stores/project.js'

export default {
  setup() {
    const projectStore = useProjectStore()
    const { projects, selectedProject, pinnedProjectId } = storeToRefs(projectStore)
    const projectFilter = ref('')

    const filteredProjects = computed(() => {
      const filter = projectFilter.value.toLowerCase().trim()
      if (!filter) return projects.value
      return projects.value.filter(p => {
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
      selectedProject,
      pinnedProjectId,
      projectFilter,
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
.project-item.pinned {
  background: #1a3344 !important;
}
.project-item .pin-btn {
  cursor: pointer;
  opacity: 0.3;
  font-size: 0.7rem;
  transition: opacity 0.15s;
  line-height: 1;
  flex-shrink: 0;
}
.project-item .pin-btn.pinned {
  opacity: 1;
}
.project-item .pin-btn:hover {
  opacity: 1;
}
</style>
