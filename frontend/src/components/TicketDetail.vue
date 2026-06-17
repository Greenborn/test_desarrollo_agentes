<template>
  <div class="d-flex flex-column h-100 text-light p-4 overflow-y-auto" style="background: #1a1a2e;">
    <div class="d-flex align-items-center mb-4">
      <button class="btn btn-sm btn-outline-argentina me-3" @click="goBack">
        ← Volver al chat
      </button>
      <h5 class="mb-0">Detalle del Ticket #{{ ticket.redmine_id }}</h5>
    </div>

    <div class="card bg-dark border-secondary mb-3">
      <div class="card-body">
        <div class="mb-3">
          <label class="form-label small text-secondary">ID Redmine</label>
          <div class="form-control bg-dark text-light border-secondary">{{ ticket.redmine_id }}</div>
        </div>
        <div class="mb-3">
          <label class="form-label small text-secondary">Asunto</label>
          <div class="form-control bg-dark text-light border-secondary">{{ ticket.subject }}</div>
        </div>
        <div class="mb-3">
          <label class="form-label small text-secondary">Proyecto</label>
          <div class="form-control bg-dark text-light border-secondary">{{ ticket.proyecto_id }}</div>
        </div>
      </div>
    </div>

    <div class="card bg-dark border-secondary mb-3">
      <div class="card-header border-secondary">
        <h6 class="mb-0">Estado y asignación</h6>
      </div>
      <div class="card-body">
        <div class="row">
          <div class="col-6 mb-3">
            <label class="form-label small text-secondary">Estado</label>
            <div class="form-control bg-dark text-light border-secondary">{{ ticket.status_name || '(sin datos)' }}</div>
          </div>
          <div class="col-6 mb-3">
            <label class="form-label small text-secondary">Prioridad</label>
            <div class="form-control bg-dark text-light border-secondary">{{ ticket.priority_name || '(sin datos)' }}</div>
          </div>
          <div class="col-6 mb-3">
            <label class="form-label small text-secondary">Tracker</label>
            <div class="form-control bg-dark text-light border-secondary">{{ ticket.tracker_name || '(sin datos)' }}</div>
          </div>
          <div class="col-6 mb-3">
            <label class="form-label small text-secondary">Asignado a</label>
            <div class="form-control bg-dark text-light border-secondary">{{ ticket.assigned_to_name || '(sin datos)' }}</div>
          </div>
          <div class="col-6 mb-3">
            <label class="form-label small text-secondary">Autor</label>
            <div class="form-control bg-dark text-light border-secondary">{{ ticket.author_name || '(sin datos)' }}</div>
          </div>
          <div class="col-6 mb-3">
            <label class="form-label small text-secondary">% completado</label>
            <div class="form-control bg-dark text-light border-secondary">{{ ticket.done_ratio != null ? ticket.done_ratio + '%' : '(sin datos)' }}</div>
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
          <div class="col-6 mb-3">
            <label class="form-label small text-secondary">Fecha inicio</label>
            <div class="form-control bg-dark text-light border-secondary">{{ ticket.start_date || '(sin datos)' }}</div>
          </div>
          <div class="col-6 mb-3">
            <label class="form-label small text-secondary">Fecha vencimiento</label>
            <div class="form-control bg-dark text-light border-secondary">{{ ticket.due_date || '(sin datos)' }}</div>
          </div>
          <div class="col-6 mb-3">
            <label class="form-label small text-secondary">Creado en Redmine</label>
            <div class="form-control bg-dark text-light border-secondary">{{ formatDate(ticket.redmine_created_on) }}</div>
          </div>
          <div class="col-6 mb-3">
            <label class="form-label small text-secondary">Última actualización</label>
            <div class="form-control bg-dark text-light border-secondary">{{ formatDate(ticket.redmine_updated_on) }}</div>
          </div>
          <div class="col-6 mb-3">
            <label class="form-label small text-secondary">Cerrado en Redmine</label>
            <div class="form-control bg-dark text-light border-secondary">{{ formatDate(ticket.redmine_closed_on) }}</div>
          </div>
          <div class="col-6 mb-3">
            <label class="form-label small text-secondary">Horas estimadas</label>
            <div class="form-control bg-dark text-light border-secondary">{{ ticket.estimated_hours != null ? ticket.estimated_hours + ' h' : '(sin datos)' }}</div>
          </div>
          <div class="col-6 mb-3">
            <label class="form-label small text-secondary">Versión</label>
            <div class="form-control bg-dark text-light border-secondary">{{ ticket.fixed_version_name || '(sin datos)' }}</div>
          </div>
        </div>
      </div>
    </div>

    <div class="card bg-dark border-secondary mb-3">
      <div class="card-header border-secondary">
        <h6 class="mb-0">Descripción</h6>
      </div>
      <div class="card-body">
        <pre class="form-control bg-dark text-light border-secondary mb-0" style="white-space: pre-wrap; word-break: break-word; min-height: 100px;">{{ ticket.description || '(sin descripción)' }}</pre>
      </div>
    </div>
  </div>
</template>

<script>
import { storeToRefs } from 'pinia'
import { useTicketStore } from '../stores/ticket.js'

export default {
  setup() {
    const ticketStore = useTicketStore()
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
      } catch {
        return dateStr
      }
    }

    return {
      ticket: selectedTicket,
      goBack,
      formatDate,
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
