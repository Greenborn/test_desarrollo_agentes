<template>
  <div>
    <div class="mb-2">
      <label class="small text-secondary mb-1">Clave</label>
      <input ref="claveInput" v-model="createClave" class="form-control form-control-sm bg-dark text-light border-secondary"
        style="font-size: 0.75rem;" placeholder="nombre_de_la_nota" maxlength="255" />
    </div>
    <div class="mb-2">
      <label class="small text-secondary mb-1">Tipo de documentación</label>
      <div class="d-flex gap-3">
        <label class="d-flex align-items-center gap-1" style="cursor:pointer;font-size:0.75rem;color:#cbd5e1;">
          <input type="radio" value="general" v-model="createTicketType" class="form-check-input m-0" />
          General
        </label>
        <label class="d-flex align-items-center gap-1" style="cursor:pointer;font-size:0.75rem;color:#cbd5e1;">
          <input type="radio" value="especifica" v-model="createTicketType" class="form-check-input m-0" />
          Específica
        </label>
      </div>
    </div>
    <div v-if="createTicketType === 'especifica'" class="mb-2">
      <label class="small text-secondary mb-1">Ticket Redmine</label>
      <select v-model="createTicket" class="form-select form-select-sm bg-dark text-light border-secondary"
        style="font-size: 0.75rem;">
        <option value="" disabled>Seleccione un ticket</option>
        <option v-for="t in tickets" :key="t.redmine_id" :value="t.redmine_id">
          #{{ t.redmine_id }} — {{ t.subject }}
        </option>
      </select>
    </div>
    <div class="mb-2">
      <label class="small text-secondary mb-1">Valor</label>
      <textarea v-model="createValor" class="form-control form-control-sm bg-dark text-light border-secondary"
        style="font-size: 0.75rem; min-height: 120px;" maxlength="16384" placeholder="Contenido…"></textarea>
      <div class="text-end" style="font-size: 0.6rem; color: #6b7280;">
        {{ createValor?.length || 0 }} / 16384
      </div>
    </div>
    <div v-if="createError" class="text-danger small mt-2">{{ createError }}</div>
    <div class="d-flex gap-2 justify-content-end mt-3">
      <button class="btn btn-sm btn-outline-secondary py-0 px-3" style="font-size: 0.7rem;" @click="$emit('close')">Cancelar</button>
      <button class="btn btn-sm btn-outline-success py-0 px-3" style="font-size: 0.7rem;" @click="crearNota" :disabled="!createClave || !createValor || (createTicketType === 'especifica' && !createTicket)">Crear</button>
    </div>
  </div>
</template>

<script>
import { ref, onMounted, nextTick } from 'vue'
import { useDocumentacionNotasStore } from '../../stores/documentacionNotas.js'

export default {
  props: {
    proyectoId: { type: [String, Number], required: true },
    ticketId: { type: [Number, String], default: null },
  },
  emits: ['close'],
  setup(props, { emit }) {
    const store = useDocumentacionNotasStore()
    const createClave = ref('')
    const createValor = ref('')
    const createTicket = ref('')
    const createTicketType = ref('general')
    const createError = ref('')
    const tickets = ref([])
    const claveInput = ref(null)

    onMounted(() => {
      createTicket.value = props.ticketId || ''
      createTicketType.value = props.ticketId ? 'especifica' : 'general'
      loadTickets()
      nextTick(() => {
        if (claveInput.value) claveInput.value.focus()
      })
    })

    async function loadTickets() {
      if (!props.proyectoId) return
      try {
        const res = await fetch(`/api/tickets?proyecto_id=${encodeURIComponent(props.proyectoId)}`, { credentials: 'include' })
        if (res.ok) {
          const data = await res.json()
          tickets.value = data.tickets || []
        }
      } catch (err) {
        console.error('Error al cargar tickets:', err)
        tickets.value = []
      }
    }

    async function crearNota() {
      if (!createClave.value || !createValor.value) return
      if (createTicketType.value === 'especifica' && !createTicket.value) {
        createError.value = 'Debe seleccionar un ticket para documentación específica'
        return
      }
      const payload = {
        id_proyecto: props.proyectoId,
        clave: createClave.value,
        valor: createValor.value,
      }
      if (createTicketType.value === 'especifica') {
        payload.id_ticket = parseInt(createTicket.value, 10)
      }
      try {
        await store.createNota(payload)
        emit('close')
      } catch (err) {
        createError.value = err.message
      }
    }

    return { createClave, createValor, createTicket, createTicketType, createError, tickets, claveInput, crearNota }
  },
}
</script>
