<template>
  <div class="d-flex flex-column h-100 text-light p-4 overflow-y-auto" style="background: #1a2744;">
    <div class="d-flex align-items-center mb-3">
      <button class="btn btn-sm btn-outline-argentina me-3" @click="goBack">
        ← Volver al chat
      </button>
      <h5 class="mb-0">Detalle del Ticket #{{ ticket.redmine_id }}</h5>
    </div>

    <div class="card bg-dark border-secondary mb-3">
      <div class="card-header border-secondary">
        <h6 class="mb-0">Estado y asignación</h6>
      </div>
      <div class="card-body">
        <div class="row">
          <div class="col-6 mb-2">
            <label class="form-label small text-secondary mb-1">ID Redmine</label>
            <div class="text-light">{{ ticket.redmine_id }}</div>
          </div>
          <div class="col-6 mb-2">
            <label class="form-label small text-secondary mb-1">Proyecto</label>
            <div class="text-light">{{ ticket.proyecto_id }}</div>
          </div>
          <div class="col-12 mb-2">
            <label class="form-label small text-secondary mb-1">Asunto</label>
            <div class="text-light">{{ ticket.subject }}</div>
          </div>
        </div>
        <hr class="border-secondary my-2">
        <div class="row">
          <div class="col-4 mb-2">
            <label class="form-label small text-secondary mb-1">Estado</label>
            <div class="text-light">{{ ticket.status_name || '(sin datos)' }}</div>
          </div>
          <div class="col-4 mb-2">
            <label class="form-label small text-secondary mb-1">Prioridad</label>
            <div class="text-light">{{ ticket.priority_name || '(sin datos)' }}</div>
          </div>
          <div class="col-4 mb-2">
            <label class="form-label small text-secondary mb-1">Tracker</label>
            <div class="text-light">{{ ticket.tracker_name || '(sin datos)' }}</div>
          </div>
          <div class="col-4 mb-2">
            <label class="form-label small text-secondary mb-1">Asignado a</label>
            <div class="text-light">{{ ticket.assigned_to_name || '(sin datos)' }}</div>
          </div>
          <div class="col-4 mb-2">
            <label class="form-label small text-secondary mb-1">Autor</label>
            <div class="text-light">{{ ticket.author_name || '(sin datos)' }}</div>
          </div>
          <div class="col-4 mb-2">
            <label class="form-label small text-secondary mb-1">% completado</label>
            <div class="text-light">{{ ticket.done_ratio != null ? ticket.done_ratio + '%' : '(sin datos)' }}</div>
          </div>
        </div>
      </div>
    </div>

    <div class="card bg-dark border-secondary mb-3">
      <div class="card-header border-secondary">
        <h6 class="mb-0">Fechas y estimación</h6>
      </div>
      <div class="card-body">
        <div class="row">
          <div class="col-4 mb-2">
            <label class="form-label small text-secondary mb-1">Fecha inicio</label>
            <div class="text-light">{{ ticket.start_date || '(sin datos)' }}</div>
          </div>
          <div class="col-4 mb-2">
            <label class="form-label small text-secondary mb-1">Fecha vencimiento</label>
            <div class="text-light">{{ ticket.due_date || '(sin datos)' }}</div>
          </div>
          <div class="col-4 mb-2">
            <label class="form-label small text-secondary mb-1">Creado en Redmine</label>
            <div class="text-light">{{ formatDate(ticket.redmine_created_on) }}</div>
          </div>
          <div class="col-4 mb-2">
            <label class="form-label small text-secondary mb-1">Última actualización</label>
            <div class="text-light">{{ formatDate(ticket.redmine_updated_on) }}</div>
          </div>
          <div class="col-4 mb-2">
            <label class="form-label small text-secondary mb-1">Cerrado en Redmine</label>
            <div class="text-light">{{ formatDate(ticket.redmine_closed_on) }}</div>
          </div>
          <div class="col-4 mb-2">
            <label class="form-label small text-secondary mb-1">Horas estimadas</label>
            <div class="text-light">{{ ticket.estimated_hours != null ? ticket.estimated_hours + ' h' : '(sin datos)' }}</div>
          </div>
          <div class="col-4 mb-2">
            <label class="form-label small text-secondary mb-1">Versión</label>
            <div class="text-light">{{ ticket.fixed_version_name || '(sin datos)' }}</div>
          </div>
        </div>
      </div>
    </div>

    <div class="card bg-dark border-secondary mb-0 d-flex flex-column">
      <div class="card-header border-secondary">
        <h6 class="mb-0">Descripción</h6>
      </div>
      <div class="card-body">
        <pre class="text-light mb-0" style="white-space: pre-wrap; word-break: break-word;">{{ ticket.description || '(sin descripción)' }}</pre>
      </div>
    </div>

    <div class="card bg-dark border-secondary mt-3" v-if="attachments.length > 0">
      <div class="card-header border-secondary">
        <h6 class="mb-0">Adjuntos ({{ attachments.length }})</h6>
      </div>
      <div class="card-body">
        <div v-for="a in attachments" :key="a.id" class="mb-3">
          <div v-if="isImage(a)" class="mb-1">
            <img :src="'/api/tickets/attachments/' + a.id + '/download'" :alt="a.filename" class="img-fluid rounded" style="max-width:100%;height:auto;border:1px solid #555;">
          </div>
          <div>
            <a :href="'/api/tickets/attachments/' + a.id + '/download'" target="_blank" class="btn btn-sm btn-outline-argentina">
              ⬇ {{ a.filename }} ({{ formatSize(a.filesize) }})
            </a>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>

<script>
import { storeToRefs } from 'pinia'
import { useTicketStore } from '../../stores/ticket.js'
import { useAttachmentsStore } from '../../stores/attachments.js'

export default {
  setup() {
    const ticketStore = useTicketStore()
    const attStore = useAttachmentsStore()
    const { selectedTicket } = storeToRefs(ticketStore)

    function goBack() {
      ticketStore.clearSelection()
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

    function isImage(a) {
      return a.content_type && a.content_type.startsWith('image/')
    }

    function formatSize(bytes) {
      if (!bytes) return ''
      const kb = bytes / 1024
      if (kb < 1024) return kb.toFixed(1) + ' KB'
      return (kb / 1024).toFixed(1) + ' MB'
    }

    if (selectedTicket.value?.redmine_id) {
      attStore.fetchByTicket(selectedTicket.value.redmine_id)
    }

    return {
      ticket: selectedTicket,
      goBack,
      formatDate,
      attachments: attStore.items,
      isImage,
      formatSize,
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
