<template>
  <div class="d-flex flex-column gap-3">
    <div
      v-for="project in projects"
      :key="project.id"
      class="rounded-3 p-3"
      style="background: #1a2744; border: 1px solid #374151;"
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
        <pre class="small mb-0 p-2 rounded" style="background: #1a2744; border: 1px solid #2a2a3e; white-space: pre-wrap; word-break: break-word; max-height: 120px; overflow-y: auto; color: #e0e0e0;">{{ project.description }}</pre>
      </div>

      
    </div>
  </div>
</template>

<script>
export default {
  props: {
    projects: { type: Array, required: true },
  },
  data() {
    return {
    }
  },
  methods: {
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
