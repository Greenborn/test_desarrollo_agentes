<template>
  <div v-if="!activeSession" class="d-flex flex-column align-items-center justify-content-center flex-grow-1 text-secondary small px-3 text-center">
    <span>Seleccione una sesión de chat</span>
  </div>
  <div v-else-if="!proyectoId" class="d-flex flex-column align-items-center justify-content-center flex-grow-1 text-secondary small px-3 text-center">
    <span>Sin proyecto asignado a esta sesión</span>
  </div>
  <div v-else-if="loadingVariables" class="d-flex flex-column align-items-center justify-content-center flex-grow-1 text-secondary small">
    <span>Cargando variables…</span>
  </div>
  <div v-else class="variables-table flex-grow-1 overflow-y-auto px-2 py-1 d-flex flex-column" style="min-height: 0;">
    <button class="btn btn-sm btn-outline-argentina w-100 mb-2" style="font-size: 0.7rem;" @click.stop="agregarVariable">+ Agregar variable</button>
    <div class="flex-grow-1" style="min-height: 0;">
      <TableEditor
        id="variables"
        :data="tableData"
        :config="tableConfig"
        @rowDoubleClick="onRowDblClick"
      />
    </div>
  </div>
</template>

<script>
import { watch, computed } from 'vue'
import { storeToRefs } from 'pinia'
import { useChatStore } from '../../../stores/chat.js'
import { useProjectVariablesStore } from '../../../stores/projectVariables.js'
import { useModal } from 'vue-greenborn-modal-manager'
import VariableDetailModal from '../../../components/modals/VariableDetailModal.vue'
import CreateVariableModal from '../../../components/modals/CreateVariableModal.vue'
import TableEditor from '../../../components/TableEditor.vue'

export default {
  components: { TableEditor },
  setup() {
    const chat = useChatStore()
    const { mostrar_modal } = useModal()
    const projectVariables = useProjectVariablesStore()
    const { activeSessionId, sessions } = storeToRefs(chat)

    const activeSession = computed(() => {
      return sessions.value.find(s => Number(s.id) === Number(activeSessionId.value)) || null
    })

    const proyectoId = computed(() => activeSession.value?.proyecto_id || null)

    const variables = computed(() => projectVariables.variablesByProject[proyectoId.value] || [])
    const loadingVariables = computed(() => projectVariables.loadingByProject[proyectoId.value] || false)

    const tableData = computed(() => ({
      fields_def: [
        { field: 'key', headerName: 'Key' },
        { field: 'value', headerName: 'Value' },
        { field: 'type', headerName: 'Type' },
      ],
      rows: variables.value.map(v => ({
        key: v.key,
        value: v.value,
        type: v.type || '',
      })),
    }))

    const tableConfig = computed(() => ({
      selectionMode: 'single',
      hideToolbar: true,
      hideRefresh: true,
      hideCsvExport: true,
      showPaginator: false,
      striped: true,
      scrollHeight: '100%',
      pageSize: 200,
      valueFormatters: {
        type(row) {
          return row.type === 'memory'
            ? '<span class="badge bg-info" style="font-size:0.55rem;line-height:1.2;">mem</span>'
            : (row.type || '')
        },
      },
    }))

    function openVariableDetail(variable) {
      mostrar_modal(VariableDetailModal, variable.key, { variable, proyectoId: proyectoId.value })
    }

    function onRowDblClick({ data }) {
      const variable = variables.value.find(v => v.key === data.key)
      if (variable) openVariableDetail(variable)
    }

    function agregarVariable() {
      mostrar_modal(CreateVariableModal, 'Nueva Variable', {})
    }

    watch([proyectoId, activeSessionId], () => {
      const pid = proyectoId.value
      if (!pid) {
        projectVariables.clearVariables()
        return
      }
      projectVariables.loadVariables(pid)
    }, { immediate: true })

    return {
      activeSession,
      proyectoId,
      loadingVariables,
      tableData,
      tableConfig,
      onRowDblClick,
      agregarVariable,
    }
  },
}
</script>

<style scoped>
.variables-table {
  background: #16213e;
}
</style>
