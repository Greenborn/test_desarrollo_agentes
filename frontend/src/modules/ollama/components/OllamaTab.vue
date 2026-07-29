<template>
  <div class="h-100 d-flex flex-column" style="min-height: 0;">
    <div class="d-flex align-items-center gap-2 px-2 py-1 flex-shrink-0 border-bottom border-secondary">
      <span class="small fw-semibold text-light" style="font-size: 0.75rem;">Modelos Ollama</span>
      <button
        class="btn btn-sm py-0 px-2"
        style="font-size: 0.7rem; background: rgba(117, 170, 219, 0.15); color: #75AADB; border: 1px solid rgba(117, 170, 219, 0.3);"
        :disabled="!selectedRow"
        @click="abrirModalConfig"
      >Configurar</button>
      <button
        class="btn btn-sm py-0 px-2"
        style="font-size: 0.7rem; background: rgba(117, 170, 219, 0.15); color: #75AADB; border: 1px solid rgba(117, 170, 219, 0.3);"
        @click="abrirModalInstalar"
      >+ Instalar</button>
      <button
        v-if="commitModelName"
        class="btn btn-sm py-0 px-2"
        style="font-size: 0.7rem; color: #ef4444; background: none; border: 1px solid rgba(239, 68, 68, 0.3);"
        @click="resetearCommitModel"
      >Reset</button>
      <button
        class="btn btn-sm py-0 px-1 ms-auto"
        style="font-size: 0.7rem; color: #6b7280; background: none; border: none; line-height: 1;"
        @click="cargarModelos"
        :disabled="cargando"
      >↻</button>
    </div>

    <div v-if="cargando && modelos.length === 0" class="flex-grow-1 d-flex align-items-center justify-content-center">
      <span class="small text-muted">Cargando modelos...</span>
    </div>

    <div v-else-if="errorMsg && modelos.length === 0" class="flex-grow-1 d-flex flex-column align-items-center justify-content-center text-muted small" style="gap: 8px;">
      <span>{{ errorMsg }}</span>
      <button
        class="btn btn-sm py-0 px-2"
        style="font-size: 0.7rem; color: #75AADB; background: none; border: 1px solid rgba(117, 170, 219, 0.3);"
        @click="cargarModelos"
      >Reintentar</button>
    </div>

    <div v-else-if="modelos.length === 0" class="flex-grow-1 d-flex flex-column align-items-center justify-content-center text-muted small" style="gap: 8px;">
      <span>No hay modelos instalados.</span>
      <button
        class="btn btn-sm py-0 px-2"
        style="font-size: 0.7rem; background: rgba(117, 170, 219, 0.15); color: #75AADB; border: 1px solid rgba(117, 170, 219, 0.3);"
        @click="abrirModalInstalar"
      >Instalar un modelo</button>
    </div>

    <div v-else class="flex-grow-1" style="min-height: 0;">
      <TableEditor
        ref="tableEditor"
        id="ollama-modelos"
        :data="tableData"
        :config="tableConfig"
        @rowSelected="onRowSelected"
      />
    </div>

    <div v-if="statusMsg" class="px-2 py-1 small" style="font-size: 0.65rem; color: #75AADB; background: rgba(117, 170, 219, 0.08); border-top: 1px solid #374151;">
      {{ statusMsg }}
    </div>

    <div v-if="errorTmp" class="px-2 py-1 small" style="font-size: 0.65rem; color: #ef4444; background: rgba(239, 68, 68, 0.08); border-top: 1px solid #374151;">
      {{ errorTmp }}
    </div>

    <div class="modal fade" tabindex="-1" ref="modalInstalar">
      <div class="modal-dialog modal-sm">
        <div class="modal-content" style="background: #16213e; color: #e0e0e0;">
          <div class="modal-header" style="padding: 0.5rem 0.75rem; border-bottom: 1px solid #374151;">
            <h6 class="modal-title" style="font-size: 0.8rem;">Instalar Modelo Ollama</h6>
            <button type="button" class="btn-close btn-close-white" style="font-size: 0.6rem;" @click="cerrarModalInstalar"></button>
          </div>
          <form @submit.prevent="instalarModelo">
            <div class="modal-body" style="padding: 0.5rem 0.75rem;">
              <label class="small text-secondary mb-1" style="font-size: 0.7rem;">Nombre del modelo</label>
              <input
                v-model="nombreModelo"
                type="text"
                class="form-control form-control-sm"
                placeholder="ej: llama3.2, mistral"
                style="background: #0d1117; border-color: #374151; color: #e0e0e0; font-size: 0.75rem;"
                ref="inputModelo"
              />
              <div v-if="errorModal" class="small text-danger mt-1" style="font-size: 0.65rem;">{{ errorModal }}</div>
            </div>
            <div class="modal-footer" style="padding: 0.4rem 0.75rem; border-top: 1px solid #374151;">
              <button type="button" class="btn btn-sm btn-secondary py-0 px-2" style="font-size: 0.7rem;" @click="cerrarModalInstalar">Cancelar</button>
              <button type="submit" class="btn btn-sm py-0 px-2" style="font-size: 0.7rem; background: rgba(117, 170, 219, 0.15); color: #75AADB; border: 1px solid rgba(117, 170, 219, 0.3);" :disabled="instalando || !nombreModelo.trim()">
                {{ instalando ? 'Instalando...' : 'Instalar' }}
              </button>
            </div>
          </form>
        </div>
      </div>
    </div>
  </div>
</template>

<script>
import { ref, computed, onMounted, onBeforeUnmount, nextTick } from 'vue'
import { Modal } from 'bootstrap'
import TableEditor from '../../../components/TableEditor.vue'
import { BtnConfig } from '../../../components/BtnConfig.js'
import ConfirmModal from '../../../components/modals/ConfirmModal.vue'
import OllamaConfigModal from './OllamaConfigModal.vue'
import { useModalStore } from '../../../stores/modal.js'

export default {
  components: { TableEditor },
  setup() {
    const modal = useModalStore()
    const modelos = ref([])
    const cargando = ref(false)
    const errorMsg = ref('')
    const statusMsg = ref('')
    const errorTmp = ref('')
    const instalando = ref(false)
    const eliminando = ref(null)
    const nombreModelo = ref('')
    const errorModal = ref('')
    const modalInstalar = ref(null)
    const inputModelo = ref(null)
    const tableEditor = ref(null)
    let modalInstance = null

    const selectedRow = ref(null)
    const commitModelName = ref('')

    function formatearTamano(bytes) {
      if (!bytes) return '-'
      const units = ['B', 'KB', 'MB', 'GB', 'TB']
      let i = 0
      let size = bytes
      while (size >= 1024 && i < units.length - 1) {
        size /= 1024
        i++
      }
      return size.toFixed(1) + ' ' + units[i]
    }

    function formatearFecha(iso) {
      if (!iso) return '-'
      try {
        const d = new Date(iso)
        return d.toLocaleDateString() + ' ' + d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
      } catch {
        return iso
      }
    }

    const tableData = computed(() => ({
      fields_def: [
        { field: 'name', headerName: 'Modelo' },
        { field: 'size', headerName: 'Tamaño' },
        { field: 'modified', headerName: 'Modificado' },
        { field: 'commitModel', headerName: 'Commits', sortable: false },
      ],
      rows: modelos.value.map(m => {
        const isCommit = commitModelName.value && m.name === commitModelName.value
        return {
          name: m.name,
          _nameClass: isCommit ? 'text-info fw-semibold' : '',
          size: formatearTamano(m.size),
          modified: formatearFecha(m.modified_at),
          commitModel: isCommit ? '✔' : '',
          _commitModelClass: isCommit ? 'text-info' : 'text-muted',
          _raw: m,
        }
      }),
    }))

    const tableConfig = computed(() => ({
      selectionMode: 'single',
      hideToolbar: true,
      hideRefresh: true,
      hideCsvExport: true,
      showPaginator: false,
      striped: false,
      infiniteScroll: false,
      rowActions: [
        new BtnConfig({
          key: 'delete',
          icon: 'bi bi-trash',
          severity: 'btn-outline-danger',
          label: '🗑',
          onClick: (row) => confirmarEliminar(row._raw),
          isDisabled: (row) => eliminando.value === row._raw.name,
        }),
      ],
    }))

    function limpiarStatus() {
      setTimeout(() => {
        statusMsg.value = ''
        errorTmp.value = ''
      }, 5000)
    }

    async function cargarModelos() {
      cargando.value = true
      errorMsg.value = ''
      try {
        const res = await fetch('/api/ollama/tags', { credentials: 'include' })
        const data = await res.json()
        if (data.status) {
          modelos.value = data.data || []
        } else {
          errorMsg.value = data.error || 'Error al cargar modelos'
        }
      } catch (err) {
        console.log('[OllamaTab] Error al cargar modelos:', err)
        errorMsg.value = 'Error de conexión con el servidor'
      } finally {
        cargando.value = false
      }
    }

    function abrirModalInstalar() {
      errorModal.value = ''
      nombreModelo.value = ''
      modalInstance.show()
      nextTick(() => {
        if (inputModelo.value) inputModelo.value.focus()
      })
    }

    function cerrarModalInstalar() {
      modalInstance.hide()
    }

    async function instalarModelo() {
      const name = nombreModelo.value.trim()
      if (!name) {
        errorModal.value = 'Ingrese un nombre de modelo'
        return
      }
      instalando.value = true
      errorModal.value = ''
      try {
        const res = await fetch('/api/ollama/pull', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          credentials: 'include',
          body: JSON.stringify({ name }),
        })
        const data = await res.json()
        if (data.status) {
          cerrarModalInstalar()
          statusMsg.value = 'Modelo "' + name + '" instalado correctamente'
          limpiarStatus()
          await cargarModelos()
        } else {
          errorModal.value = data.error || 'Error al instalar modelo'
        }
      } catch (err) {
        console.log('[OllamaTab] Error al instalar modelo:', err)
        errorModal.value = 'Error de conexión con el servidor'
      } finally {
        instalando.value = false
      }
    }

    function confirmarEliminar(modelo) {
      modal.open(ConfirmModal, {
        message: '¿Eliminar el modelo "' + modelo.name + '"?',
        confirmLabel: 'Eliminar',
        confirmSeverity: 'btn-danger',
      }, {
        title: 'Confirmar',
        onClose: () => eliminarModelo(modelo),
      })
    }

    async function eliminarModelo(modelo) {
      eliminando.value = modelo.name
      errorTmp.value = ''
      const wasCommitModel = commitModelName.value === modelo.name
      try {
        const res = await fetch('/api/ollama/delete', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          credentials: 'include',
          body: JSON.stringify({ name: modelo.name }),
        })
        const data = await res.json()
        if (data.status) {
          if (wasCommitModel) {
            await fetch('/api/ollama/config', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              credentials: 'include',
              body: JSON.stringify({ commitModel: '' }),
            })
            commitModelName.value = ''
          }
          statusMsg.value = 'Modelo "' + modelo.name + '" eliminado'
          limpiarStatus()
          await cargarModelos()
        } else {
          errorTmp.value = data.error || 'Error al eliminar modelo'
          limpiarStatus()
        }
      } catch (err) {
        console.log('[OllamaTab] Error al eliminar modelo:', err)
        errorTmp.value = 'Error de conexión con el servidor'
        limpiarStatus()
      } finally {
        eliminando.value = null
      }
    }

    function onRowSelected(row) {
      selectedRow.value = row ? row._raw : null
    }

    async function cargarConfig() {
      try {
        const res = await fetch('/api/ollama/config', { credentials: 'include' })
        const data = await res.json()
        if (data.status) {
          commitModelName.value = data.data.commitModel || ''
        }
      } catch (err) {
        console.log('[OllamaTab] Error al cargar config:', err)
      }
    }

    function resetearCommitModel() {
      modal.open(ConfirmModal, {
        message: '¿Desactivar el modelo local para commits? A partir de ahora se usará DeepSeek nuevamente.',
        confirmLabel: 'Usar DeepSeek',
        confirmSeverity: 'btn-danger',
      }, {
        title: 'Resetear configuración',
        onClose: async () => {
          try {
            const res = await fetch('/api/ollama/config', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              credentials: 'include',
              body: JSON.stringify({ commitModel: '' }),
            })
            const data = await res.json()
            if (data.status) {
              commitModelName.value = ''
              statusMsg.value = 'Configuración reseteada. Se usará DeepSeek para commits.'
              limpiarStatus()
            }
          } catch (err) {
            console.log('[OllamaTab] Error al resetear config:', err)
          }
        },
      })
    }

    function abrirModalConfig() {
      if (!selectedRow.value) return
      modal.open(OllamaConfigModal, {
        modelName: selectedRow.value.name,
        commitModelName: commitModelName.value,
      }, {
        title: 'Configurar Modelo',
        onClose: (result) => {
          if (result && result.commitModel !== undefined) {
            commitModelName.value = result.commitModel
            if (result.commitModel) {
              statusMsg.value = 'Modelo "' + result.commitModel + '" configurado para commits'
            } else {
              statusMsg.value = 'Configuración de commits desactivada'
            }
            limpiarStatus()
          }
        },
      })
    }

    onMounted(() => {
      const elInstalar = modalInstalar.value
      if (elInstalar) {
        modalInstance = new Modal(elInstalar)
      }
      cargarModelos()
      cargarConfig()
    })

    onBeforeUnmount(() => {
      if (modalInstance) {
        modalInstance.dispose()
        modalInstance = null
      }
    })

    return {
      modelos,
      cargando,
      errorMsg,
      statusMsg,
      errorTmp,
      instalando,
      eliminando,
      nombreModelo,
      errorModal,
      modalInstalar,
      inputModelo,
      tableEditor,
      selectedRow,
      commitModelName,
      tableData,
      tableConfig,
      formatearTamano,
      formatearFecha,
      cargarModelos,
      abrirModalInstalar,
      cerrarModalInstalar,
      instalarModelo,
      confirmarEliminar,
      eliminarModelo,
      onRowSelected,
      abrirModalConfig,
      resetearCommitModel,
    }
  },
}
</script>
