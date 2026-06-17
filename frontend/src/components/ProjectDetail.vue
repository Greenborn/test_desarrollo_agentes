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

    <div class="card bg-dark border-secondary mb-3">
      <div class="card-header border-secondary">
        <h6 class="mb-0">Información de Redmine</h6>
      </div>
      <div class="card-body">
        <div class="mb-3">
          <label class="form-label small text-secondary">ID Redmine</label>
          <div class="form-control bg-dark text-light border-secondary">{{ project.redmine_id ?? '(sin datos)' }}</div>
        </div>
        <div class="mb-3">
          <label class="form-label small text-secondary">Estado</label>
          <div class="form-control bg-dark text-light border-secondary">{{ statusLabel(project.redmine_status) }}</div>
        </div>
        <div class="mb-3">
          <label class="form-label small text-secondary">Creado en Redmine</label>
          <div class="form-control bg-dark text-light border-secondary">{{ formatDate(project.redmine_created_on) }}</div>
        </div>
        <div class="mb-3">
          <label class="form-label small text-secondary">Última actualización</label>
          <div class="form-control bg-dark text-light border-secondary">{{ formatDate(project.redmine_updated_on) }}</div>
        </div>
        <div class="mb-3">
          <label class="form-label small text-secondary">Proyecto padre</label>
          <div class="form-control bg-dark text-light border-secondary">
            <template v-if="project.redmine_parent_name">
              {{ project.redmine_parent_name }}<br>
              <span class="text-secondary small">ID: {{ project.redmine_parent_id }}</span>
            </template>
            <template v-else>(sin datos)</template>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>

<script>
import { storeToRefs } from 'pinia'
import { useProjectStore } from '../stores/project.js'

export default {
  setup() {
    const projectStore = useProjectStore()
    const { selectedProject } = storeToRefs(projectStore)

    function goBack() {
      projectStore.clearSelection()
    }

    function formatDate(dateStr) {
      if (!dateStr) return '(sin datos)'
      try {
        const d = new Date(dateStr)
        if (isNaN(d.getTime())) return dateStr
        return d.toLocaleDateString('es-ES', {
          year: 'numeric',
          month: 'long',
          day: 'numeric',
          hour: '2-digit',
          minute: '2-digit',
        })
      } catch {
        return dateStr
      }
    }

    function statusLabel(status) {
      if (status === 1) return '🟢 Activo'
      if (status === 5) return '🔴 Archivado'
      if (status === 9) return '⚪ Cerrado'
      return '(sin datos)'
    }

    return {
      project: selectedProject,
      goBack,
      formatDate,
      statusLabel,
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
