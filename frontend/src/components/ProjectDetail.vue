<template>
  <div class="d-flex flex-column h-100 text-light p-4" style="background: #1a1a2e;">
    <div class="d-flex align-items-center mb-4">
      <button class="btn btn-sm btn-outline-argentina me-3" @click="goBack">
        ← Volver al chat
      </button>
      <h5 class="mb-0">Detalle del Proyecto</h5>
    </div>

    <div class="card bg-dark border-secondary mb-3">
      <div class="card-body">
        <div class="mb-3">
          <label class="form-label small text-secondary">ID del Proyecto</label>
          <div class="form-control bg-dark text-light border-secondary">{{ project.id }}</div>
        </div>
        <div class="mb-3">
          <label class="form-label small text-secondary">Descripción</label>
          <div class="form-control bg-dark text-light border-secondary">{{ project.descripcion }}</div>
        </div>
      </div>
    </div>
  </div>
</template>

<script>
import { useProjectStore } from '../stores/project.js'

export default {
  setup() {
    const projectStore = useProjectStore()

    function goBack() {
      projectStore.clearSelection()
    }

    return {
      project: projectStore.selectedProject,
      goBack,
    }
  },
}
</script>

<style scoped>
.btn-outline-argentina {
  background-color: transparent;
  color: #75AADB;
  border: 1px solid #75AADB;
}
.btn-outline-argentina:hover {
  background-color: #1a2744;
  color: #75AADB;
}
</style>
