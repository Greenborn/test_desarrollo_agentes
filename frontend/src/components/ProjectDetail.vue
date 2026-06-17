<template>
  <div class="d-flex flex-column h-100 text-light p-4 overflow-y-auto" style="background: #1a2744;">
    <div class="d-flex align-items-center mb-3">
      <button class="btn btn-sm btn-outline-argentina me-3" @click="goBack">
        ← Volver al chat
      </button>
      <h5 class="mb-0">Detalle del Proyecto</h5>
    </div>

    <div class="card bg-dark border-secondary mb-3">
      <div class="card-header border-secondary">
        <h6 class="mb-0">Información del Proyecto</h6>
      </div>
      <div class="card-body">
        <div class="row">
          <div class="col-6 mb-2">
            <label class="form-label small text-secondary mb-1">ID del Proyecto</label>
            <div class="text-light">{{ project.id }}</div>
          </div>
          <div class="col-6 mb-2">
            <label class="form-label small text-secondary mb-1">ID Redmine</label>
            <div class="text-light">{{ project.redmine_id ?? '(sin datos)' }}</div>
          </div>
          <div class="col-4 mb-2">
            <label class="form-label small text-secondary mb-1">Estado</label>
            <div class="text-light">{{ statusLabel(project.redmine_status) }}</div>
          </div>
          <div class="col-4 mb-2">
            <label class="form-label small text-secondary mb-1">Creado en Redmine</label>
            <div class="text-light">{{ formatDate(project.redmine_created_on) }}</div>
          </div>
          <div class="col-4 mb-2">
            <label class="form-label small text-secondary mb-1">Última actualización</label>
            <div class="text-light">{{ formatDate(project.redmine_updated_on) }}</div>
          </div>
          <div class="col-12 mb-2">
            <label class="form-label small text-secondary mb-1">Proyecto padre</label>
            <div class="text-light">
              <template v-if="project.redmine_parent_name">
                {{ project.redmine_parent_name }}<br>
                <span class="text-secondary small">ID: {{ project.redmine_parent_id }}</span>
              </template>
              <template v-else>(sin datos)</template>
            </div>
          </div>
          <div class="col-12 mb-0">
            <label class="form-label small text-secondary mb-1">Descripción</label>
            <div class="text-light">{{ project.descripcion || '(sin descripción)' }}</div>
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
      } catch (err) {
        console.error('Error al formatear fecha:', err)
        return dateStr
      }
    }

    function statusLabel(status) {
      if (status === 1) return 'Activo'
      if (status === 5) return 'Archivado'
      if (status === 9) return 'Cerrado'
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
