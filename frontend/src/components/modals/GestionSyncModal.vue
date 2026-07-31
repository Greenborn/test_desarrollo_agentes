<template>
  <div class="d-flex flex-column gap-3 gestion-sync-root">
    <div v-if="!creating && !done" class="gestion-sync-list">
      <div class="table-responsive">
        <table class="table table-dark table-sm align-middle mb-0">
          <thead>
            <tr>
              <th style="width: 60px;" class="text-center">
                <input
                  type="checkbox"
                  class="form-check-input"
                  :checked="allSelected"
                  @change="toggleAll"
                  title="Seleccionar todos"
                />
              </th>
              <th>Slug</th>
              <th>Descripción</th>
              <th class="text-end" style="width: 130px;">Estado</th>
            </tr>
          </thead>
          <tbody>
            <tr v-for="proj in proyectos" :key="proj.id">
              <td class="text-center">
                <div class="form-check form-switch d-inline-block m-0">
                  <input
                    class="form-check-input"
                    type="checkbox"
                    :id="'gest-exp-' + proj.id"
                    v-model="selected[proj.id]"
                    :disabled="isImported(proj.id)"
                  />
                </div>
              </td>
              <td class="fw-semibold font-monospace">{{ displayName(proj) }}</td>
              <td>
                <div class="small text-muted text-truncate" style="max-width: 360px;">{{ proj.descripcion || '—' }}</div>
              </td>
              <td class="text-end">
                <span v-if="isImported(proj.id)" class="badge text-bg-secondary">Ya exportado</span>
                <span v-else class="badge text-bg-warning text-dark">Pendiente</span>
              </td>
            </tr>
          </tbody>
        </table>
      </div>
      <div class="small text-muted mt-2">
        {{ selectedCount }} de {{ exportableCount }} proyectos seleccionados para exportar.
      </div>
    </div>

    <div v-if="creating" class="d-flex flex-column gap-2 gestion-sync-list">
      <div v-for="proj in resultados" :key="proj.id" class="d-flex align-items-center gap-2 small">
        <span v-if="proj.status === 'loading'" class="spinner-border spinner-border-sm text-info" role="status"></span>
        <span v-else-if="proj.status === 'ok'" class="text-success">✓</span>
        <span v-else-if="proj.status === 'error'" class="text-danger">✕</span>
        <span v-else class="text-secondary">–</span>
        <span class="flex-grow-1">{{ proj.nombre }}</span>
        <span v-if="proj.status === 'loading'" class="text-info">Exportando...</span>
        <span v-else-if="proj.status === 'ok'" class="text-success">Exportado</span>
        <span v-else-if="proj.status === 'error'" class="text-danger text-truncate" style="max-width: 300px;" :title="proj.error">{{ proj.error }}</span>
      </div>
    </div>

    <div v-if="done" class="d-flex flex-column gap-2 gestion-sync-list">
      <div class="fs-6 fw-semibold text-light">Exportación completada</div>
      <div class="small text-muted">
        {{ okCount }} exportados, {{ errorCount }} errores, {{ skipCount }} omitidos.
      </div>
      <div v-if="errorsList.length" class="small text-danger">
        <div v-for="e in errorsList" :key="e.id">{{ e.nombre }}: {{ e.error }}</div>
      </div>
    </div>

    <div v-if="error" class="text-danger small">{{ error }}</div>

    <div class="d-flex gap-2 mt-2 gestion-sync-footer">
      <button
        v-if="!done"
        class="btn btn-argentina flex-grow-1"
        :disabled="creating || selectedCount === 0"
        @click="startExport"
      >
        {{ creating ? 'Exportando...' : 'Exportar seleccionados' }}
      </button>
      <button
        v-if="done"
        class="btn btn-argentina flex-grow-1"
        @click="$emit('close')"
      >
        Cerrar
      </button>
      <button class="btn btn-outline-secondary" @click="$emit('close')" :disabled="creating">Cancelar</button>
    </div>
  </div>
</template>

<script>
import { ref, reactive, computed } from 'vue'

export default {
  props: {
    proyectos: { type: Array, default: () => [] },
    importedSlugs: { type: Array, default: () => [] },
    workspaceId: { type: Number, default: 0 },
  },
  emits: ['close'],
  setup(props) {
    const selected = reactive({})
    const creating = ref(false)
    const done = ref(false)
    const error = ref('')
    const resultados = ref([])

    const isImported = (slug) => props.importedSlugs.includes(slug)
    const exportableCount = computed(() => props.proyectos.filter((p) => !isImported(p.id)).length)
    const selectedCount = computed(() => Object.keys(selected).filter((k) => selected[k]).length)

    const allSelected = computed(() => {
      const exportable = props.proyectos.filter((p) => !isImported(p.id))
      return exportable.length > 0 && exportable.every((p) => selected[p.id])
    })

    function toggleAll(e) {
      const val = e.target.checked
      for (const p of props.proyectos) {
        if (!isImported(p.id)) selected[p.id] = val
      }
    }

    function displayName(proj) {
      return proj.id || 'Sin slug'
    }

    function readableName(slug) {
      return String(slug || '')
        .replace(/_/g, ' ')
        .replace(/\b\w/g, (c) => c.toUpperCase())
    }

    props.proyectos.forEach((p) => {
      if (!isImported(p.id)) selected[p.id] = true
    })

    async function startExport() {
      const targets = props.proyectos.filter((p) => selected[p.id] && !isImported(p.id))
      if (targets.length === 0) return
      creating.value = true
      error.value = ''
      resultados.value = targets.map((p) => ({
        id: p.id,
        nombre: displayName(p),
        status: 'loading',
        error: '',
      }))

      for (let i = 0; i < targets.length; i++) {
        const target = targets[i]
        const row = resultados.value[i]
        try {
          const res = await fetch('/api/gestion/proyectos/exportar', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            credentials: 'include',
            body: JSON.stringify({
              workspace_id: props.workspaceId || undefined,
              proyecto: {
                slug: target.id,
                nombre: readableName(target.id),
                descripcion: target.descripcion || '',
                color: target.color,
                url_github: target.url_github,
                workspace_id: target.workspace_id,
              },
            }),
          })
          const data = await res.json()
          if (!data.success) {
            row.status = 'error'
            row.error = data.message || 'Error al exportar proyecto'
          } else {
            row.status = 'ok'
          }
        } catch (err) {
          row.status = 'error'
          row.error = err.message
        }
      }

      done.value = true
      creating.value = false
    }

    const okCount = computed(() => resultados.value.filter((r) => r.status === 'ok').length)
    const errorCount = computed(() => resultados.value.filter((r) => r.status === 'error').length)
    const skipCount = computed(() => props.proyectos.filter((p) => isImported(p.id)).length)
    const errorsList = computed(() => resultados.value.filter((r) => r.status === 'error'))

    return {
      selected,
      creating,
      done,
      error,
      resultados,
      isImported,
      exportableCount,
      selectedCount,
      allSelected,
      toggleAll,
      displayName,
      startExport,
      okCount,
      errorCount,
      skipCount,
      errorsList,
    }
  },
}
</script>

<style scoped>
.gestion-sync-root {
  flex: 1;
  min-height: 0;
  display: flex;
  flex-direction: column;
  overflow: hidden;
}

.gestion-sync-list {
  flex: 1;
  min-height: 0;
  overflow-y: auto;
  overflow-x: hidden;
}

.gestion-sync-footer {
  flex-shrink: 0;
}
</style>
