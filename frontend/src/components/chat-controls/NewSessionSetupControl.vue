<template>
  <div class="d-flex flex-column gap-3 p-1">
    <div class="d-flex flex-column gap-2">
      <label class="small text-muted mb-0">1. Espacio de trabajo <span class="text-danger">*</span></label>
      <select v-model="workspaceId" class="form-select form-select-sm bg-dark text-light border-secondary">
        <option value="" disabled>Selecciona espacio de trabajo...</option>
        <option v-for="w in workspaces" :key="w.id" :value="String(w.id)">{{ w.name }}</option>
      </select>
    </div>

    <div class="d-flex flex-column gap-2">
      <label class="small text-muted mb-0">2. Proyecto <span class="text-danger">*</span></label>
      <select v-model="proyectoId" class="form-select form-select-sm bg-dark text-light border-secondary" :disabled="!workspaceId || projectsLoading" @change="onProjectChange">
        <option value="" disabled>{{ projectsLoading ? 'Cargando proyectos...' : (workspaceId ? 'Selecciona proyecto...' : 'Primero selecciona un espacio de trabajo') }}</option>
        <option v-for="p in projects" :key="p.id" :value="String(p.id)">{{ p.id }} — {{ p.descripcion || '' }}</option>
      </select>
      <button
        class="btn btn-sm btn-outline-secondary align-self-end"
        :disabled="!workspaceId"
        @click="abrirCrearProyecto"
      >
        + Crear proyecto en Redmine
      </button>
    </div>

    <div class="d-flex flex-column gap-2">
      <label class="small text-muted mb-0">3. Ticket (opcional)</label>
      <select v-model="ticketId" class="form-select form-select-sm bg-dark text-light border-secondary" :disabled="!proyectoId || ticketsLoading">
        <option value="" disabled>{{ ticketsLoading ? 'Cargando tickets...' : (proyectoId ? 'Selecciona ticket (opcional)...' : 'Primero selecciona un proyecto') }}</option>
        <option v-for="t in tickets" :key="t.redmine_id" :value="String(t.redmine_id)">#{{ t.redmine_id }} — {{ t.subject || '' }}</option>
      </select>
    </div>

    <div v-if="error" class="small" style="color: #ef4444;">{{ error }}</div>

    <button class="btn btn-sm btn-success align-self-end" :disabled="!canConfirm" @click="confirm()">
      Confirmar
    </button>
  </div>
</template>

<script>
import { ref, computed, watch } from 'vue'
import { useModal } from 'vue-greenborn-modal-manager'

export default {
  props: {
    workspaces: { type: Array, default: () => [] },
    preselect: { type: String, default: '' },
  },
  emits: ['confirm'],
  setup(props, { emit }) {
    const workspaceId = ref(props.preselect || '')
    const proyectoId = ref('')
    const ticketId = ref('')
    const projects = ref([])
    const tickets = ref([])
    const projectsLoading = ref(false)
    const ticketsLoading = ref(false)
    const error = ref('')

    const canConfirm = computed(() => !!workspaceId.value && !!proyectoId.value)

    watch(workspaceId, onWorkspaceChange, { immediate: true })

    async function onWorkspaceChange() {
      proyectoId.value = ''
      ticketId.value = ''
      tickets.value = []
      projects.value = []
      error.value = ''
      if (!workspaceId.value) return
      projectsLoading.value = true
      try {
        const res = await fetch(`/api/proyecto?workspace_id=${encodeURIComponent(workspaceId.value)}`, { credentials: 'include' })
        const data = await res.json()
        projects.value = data.proyectos || []
      } catch (err) {
        console.log('Error al cargar proyectos del workspace:', err)
        error.value = 'Error al cargar proyectos: ' + err.message
      } finally {
        projectsLoading.value = false
      }
    }

    async function onProjectChange() {
      ticketId.value = ''
      tickets.value = []
      error.value = ''
      if (!proyectoId.value) return
      ticketsLoading.value = true
      try {
        const res = await fetch(`/api/tickets?proyecto_id=${encodeURIComponent(proyectoId.value)}`, { credentials: 'include' })
        const data = await res.json()
        tickets.value = data.tickets || []
      } catch (err) {
        console.log('Error al cargar tickets del proyecto:', err)
        error.value = 'Error al cargar tickets: ' + err.message
      } finally {
        ticketsLoading.value = false
      }
    }

    function confirm() {
      if (!canConfirm.value) return
      emit('confirm', {
        workspaceId: workspaceId.value,
        proyectoId: proyectoId.value,
        idTicketRedmine: ticketId.value ? String(ticketId.value) : null,
      })
    }

    async function abrirCrearProyecto() {
      if (!workspaceId.value) return
      try {
        const { default: CrearProyectoRedmineModal } = await import('../modals/CrearProyectoRedmineModal.vue')
        const { mostrar_modal } = useModal()
        mostrar_modal(CrearProyectoRedmineModal, 'Crear proyecto en Redmine', {
          workspaceId: workspaceId.value,
          onCreated: handleProjectCreated,
        })
      } catch (err) {
        console.log('Error al abrir el modal de crear proyecto:', err)
        error.value = 'Error al abrir el modal: ' + err.message
      }
    }

    async function handleProjectCreated(proyecto) {
      await onWorkspaceChange()
      if (proyecto && proyecto.id) {
        proyectoId.value = String(proyecto.id)
      }
    }

    return { workspaceId, proyectoId, ticketId, projects, tickets, projectsLoading, ticketsLoading, error, canConfirm, onWorkspaceChange, onProjectChange, confirm, abrirCrearProyecto }
  },
}
</script>
