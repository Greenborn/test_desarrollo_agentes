<template>
  <div class="d-flex flex-column gap-3">
    <div
      v-for="project in projects"
      :key="project.id"
      class="rounded-3 p-3"
      style="background: #0f0f1e; border: 1px solid #374151;"
    >
      <div class="d-flex justify-content-between align-items-start mb-2">
        <h6 class="mb-0" style="color: #75AADB;">{{ project.name }}</h6>
        <span :class="'badge ' + statusBadge(project.status)">{{ formatStatus(project.status) }}</span>
      </div>

      <div class="small text-muted mb-2" style="color: #9ca3af !important;">
        <div><strong>ID Redmine:</strong> {{ project.id }}</div>
        <div><strong>Identificador:</strong> <code>{{ project.identifier }}</code></div>
        <div><strong>Creado:</strong> {{ formatDate(project.created_on) }}</div>
        <div><strong>Actualizado:</strong> {{ formatDate(project.updated_on) }}</div>
        <div><strong>Proyecto padre:</strong> {{ project.parent ? project.parent.name + ' (ID: ' + project.parent.id + ')' : '—' }}</div>
      </div>

      <div v-if="project.description" class="mb-2">
        <pre class="small mb-0 p-2 rounded" style="background: #1a1a2e; border: 1px solid #2a2a3e; white-space: pre-wrap; word-break: break-word; max-height: 120px; overflow-y: auto; color: #e0e0e0;">{{ project.description }}</pre>
      </div>

      <div class="d-flex justify-content-end">
        <button
          v-if="!imported[project.id]"
          class="btn btn-sm btn-outline-argentina"
          :disabled="loading[project.id]"
          @click="importProject(project)"
        >
          <span v-if="loading[project.id]" class="spinner-border spinner-border-sm me-1"></span>
          {{ loading[project.id] ? 'Importando...' : 'Importar' }}
        </button>
        <span v-else class="badge bg-success">Importado ✓</span>
      </div>
    </div>
  </div>
</template>

<script>
export default {
  props: {
    projects: { type: Array, required: true },
  },
  emits: ['confirm'],
  data() {
    return {
      loading: {},
      imported: {},
    }
  },
  methods: {
    async importProject(project) {
      this.loading = { ...this.loading, [project.id]: true }
      try {
        const res = await fetch('/api/redmine/proyectos/import', {
          method: 'POST',
          credentials: 'include',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            id: project.id,
            name: project.name,
            description: project.description,
            status: project.status,
            created_on: project.created_on,
            updated_on: project.updated_on,
            parent: project.parent,
          }),
        })
        const data = await res.json()
        if (data.success) {
          this.imported = { ...this.imported, [project.id]: true }
          this.$emit('confirm', { action: 'imported', proyectoId: data.proyectoId, projectName: project.name })
        } else {
          alert(data.message || 'Error al importar proyecto.')
        }
      } catch (err) {
        console.error('Error al importar proyecto Redmine:', err.message)
        alert('Error de conexión al importar proyecto.')
      } finally {
        this.loading = { ...this.loading, [project.id]: false }
      }
    },
    formatDate(dateStr) {
      if (!dateStr) return '—'
      const d = new Date(dateStr)
      if (isNaN(d.getTime())) return dateStr
      return d.toLocaleString('es-ES', {
        year: 'numeric', month: '2-digit', day: '2-digit',
        hour: '2-digit', minute: '2-digit',
      })
    },
    formatStatus(status) {
      if (status === 1) return 'activo'
      if (status === 5) return 'archivado'
      if (status === 9) return 'cerrado'
      return `desconocido (${status})`
    },
    statusBadge(status) {
      if (status === 1) return 'bg-success'
      if (status === 5) return 'bg-secondary'
      if (status === 9) return 'bg-danger'
      return 'bg-warning text-dark'
    },
  },
}
</script>

<style scoped>
.btn-outline-argentina {
  background-color: transparent;
  color: #75AADB;
  border: 1px solid #75AADB;
}
.btn-outline-argentina:hover:not(:disabled) {
  background-color: #1a2a4e;
  color: #75AADB;
}
.btn-outline-argentina:disabled {
  opacity: 0.6;
}
code {
  color: #E8B800;
}
</style>
