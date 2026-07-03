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
          <div class="col-12 mb-2">
            <label class="form-label small text-secondary mb-1">Color identificativo</label>
            <div class="d-flex align-items-center gap-2">
              <input type="color" :value="project.color || '#6b7280'" @input="updateColor" class="form-control form-control-color p-0" style="width: 40px; height: 32px; border: none; cursor: pointer;" />
              <span class="text-light small font-monospace">{{ project.color || '#6b7280' }}</span>
              <span v-if="savingColor" class="spinner-border spinner-border-sm text-secondary ms-1" role="status"></span>
            </div>
          </div>
          <div v-if="project.url_github" class="col-12 mb-2">
            <label class="form-label small text-secondary mb-1">Repositorio GitHub</label>
            <div class="text-light">
              <a :href="project.url_github" target="_blank" rel="noopener noreferrer" class="github-link">
                {{ project.url_github }}
              </a>
            </div>
          </div>
          <div class="col-12 mb-0">
            <label class="form-label small text-secondary mb-1">Descripción</label>
            <div class="text-light">{{ project.descripcion || '(sin descripción)' }}</div>
          </div>
        </div>
      </div>
    </div>

    <div v-if="deployConfig" class="card bg-dark border-secondary mb-3">
      <div class="card-header border-secondary">
        <h6 class="mb-0">Configuración de Despliegue</h6>
      </div>
      <div class="card-body" style="max-height: 400px; overflow-y: auto;">
        <JsonTreeView :data="deployConfig" />
      </div>
    </div>
  </div>
</template>

<script>
import { computed, ref } from 'vue'
import { storeToRefs } from 'pinia'
import { useProjectStore } from '../../stores/project.js'
import JsonTreeView from '../utils/JsonTreeView.vue'

export default {
  components: { JsonTreeView },
  setup() {
    const projectStore = useProjectStore()
    const { selectedProject } = storeToRefs(projectStore)
    const savingColor = ref(false)

    const deployConfig = computed(() => {
      const raw = selectedProject.value?.despliegue_config
      if (!raw) return null
      try {
        return JSON.parse(raw)
      } catch (err) {
        return null
      }
    })

    async function updateColor(e) {
      const color = e.target.value
      if (!color || !selectedProject.value?.id) return
      savingColor.value = true
      try {
        const res = await fetch(`/api/proyecto/${selectedProject.value.id}/color`, {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          credentials: 'include',
          body: JSON.stringify({ color }),
        })
        if (!res.ok) throw new Error('Error al actualizar color')
        selectedProject.value.color = color
        projectStore.updateProjectColor(selectedProject.value.id, color)
      } catch (err) {
        console.error('Error al actualizar color del proyecto:', err)
      } finally {
        savingColor.value = false
      }
    }

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
      deployConfig,
      goBack,
      formatDate,
      statusLabel,
      updateColor,
      savingColor,
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
.github-link {
  color: #60a5fa;
  text-decoration: none;
  word-break: break-all;
}
.github-link:hover {
  text-decoration: underline;
  color: #93c5fd;
}
</style>
