<template>
  <div class="csv-viewer-modal d-flex flex-column" style="height: 80vh;">
    <div v-if="loading" class="d-flex align-items-center justify-content-center flex-grow-1 text-muted small">
      Cargando archivo CSV...
    </div>
    <div v-else-if="error" class="d-flex flex-column align-items-center justify-content-center flex-grow-1 text-danger small px-3">
      <span>{{ error }}</span>
      <button class="btn btn-sm btn-outline-secondary mt-2" @click="loadFile">Reintentar</button>
    </div>
    <template v-else>
      <div class="csv-controls d-flex flex-wrap align-items-center gap-2 px-3 py-2 flex-shrink-0" style="background: #1a1a2e; border-bottom: 1px solid #374151;">
        <div class="d-flex align-items-center gap-1">
          <label class="small text-muted" style="white-space: nowrap;">Delimitador:</label>
          <select class="form-select form-select-sm" v-model="delimiter" style="width: 100px;" @change="parseCsv">
            <option value=",">Coma (,)</option>
            <option value=";">Punto y coma (;)</option>
            <option value="	">Tabulador</option>
            <option value="|">Pipe (|)</option>
          </select>
        </div>
        <div class="d-flex align-items-center gap-1">
          <label class="small text-muted" style="white-space: nowrap;">Calificador:</label>
          <select class="form-select form-select-sm" v-model="quoteChar" style="width: 90px;" @change="parseCsv">
            <option value='"'>Comillas ("")</option>
            <option value="'">Comilla simple ('')</option>
          </select>
        </div>
        <div class="form-check form-check-inline mb-0">
          <input class="form-check-input" type="checkbox" id="hasHeader" v-model="hasHeader" @change="parseCsv">
          <label class="form-check-label small text-muted" for="hasHeader">Primera fila como encabezado</label>
        </div>
        <span class="text-muted small ms-auto">Filas: {{ parsedRows.length }} | Columnas: {{ columnCount }}</span>
      </div>

      <div class="csv-table-wrapper overflow-auto flex-grow-1" style="min-height: 0;">
        <table class="table table-sm table-dark table-bordered mb-0" style="font-size: 0.75rem;">
          <thead v-if="columns.length > 0">
            <tr>
              <th class="text-center" style="width: 32px; color: #6b7280;">#</th>
              <th v-for="(col, ci) in columns" :key="ci" class="text-nowrap" style="color: #75AADB;">{{ col }}</th>
            </tr>
          </thead>
          <tbody>
            <tr v-for="(row, ri) in parsedRows" :key="ri">
              <td class="text-center text-muted">{{ ri + 1 }}</td>
              <td v-for="(cell, ci) in row" :key="ci" class="text-nowrap">{{ cell }}</td>
            </tr>
          </tbody>
        </table>
        <div v-if="parsedRows.length === 0 && !loading" class="text-muted small text-center p-4">
          No se pudieron parsear filas. Revise los parámetros de parseo.
        </div>
      </div>

      <div class="d-flex align-items-center gap-2 px-3 py-2 flex-shrink-0" style="background: #1a1a2e; border-top: 1px solid #374151;">
        <span class="text-muted small text-truncate" :title="filePath">{{ filePath }}</span>
        <button class="btn btn-sm btn-outline-secondary ms-auto" @click="$emit('close')">Cerrar</button>
      </div>
    </template>
  </div>
</template>

<script>
import { ref, computed, onMounted } from 'vue'
import { useCsvParser } from '../../composables/useCsvParser.js'

const API = '/api'

export default {
  props: {
    filePath: { type: String, required: true },
  },
  emits: ['close'],
  setup(props) {
    const { parseCsv: parse } = useCsvParser()

    const rawContent = ref('')
    const loading = ref(false)
    const error = ref(null)
    const delimiter = ref(',')
    const quoteChar = ref('"')
    const hasHeader = ref(true)
    const columns = ref([])
    const parsedRows = ref([])

    const columnCount = computed(() => columns.value.length)

    function parseCsv() {
      const result = parse(rawContent.value, delimiter.value, quoteChar.value, hasHeader.value)
      columns.value = result.columns
      parsedRows.value = result.rows
    }

    async function loadFile() {
      loading.value = true
      error.value = null
      try {
        const res = await fetch(`${API}/command/read-file?path=${encodeURIComponent(props.filePath)}`, {
          credentials: 'include',
        })
        const data = await res.json()
        if (data.success) {
          rawContent.value = data.content
          parseCsv()
        } else {
          error.value = data.error || 'Error al leer el archivo'
        }
      } catch (err) {
        error.value = err.message || 'Error de conexión'
      } finally {
        loading.value = false
      }
    }

    onMounted(() => {
      loadFile()
    })

    return {
      loading, error, delimiter, quoteChar, hasHeader,
      columns, parsedRows, columnCount,
      loadFile, parseCsv, filePath: props.filePath,
    }
  },
}
</script>

<style scoped>
.csv-viewer-modal {
  background: #0d1117;
  border-radius: 4px;
}
.csv-table-wrapper {
  background: #0d1117;
}
.csv-table-wrapper table {
  border-collapse: separate;
  border-spacing: 0;
}
.csv-table-wrapper th {
  position: sticky;
  top: 0;
  background: #1a1a2e;
  z-index: 1;
}
.csv-table-wrapper td,
.csv-table-wrapper th {
  padding: 4px 8px;
  border-color: #30363d;
  white-space: nowrap;
}
.csv-table-wrapper tbody tr:hover {
  background: rgba(117, 170, 219, 0.06);
}
.form-select-sm {
  background-color: #212529;
  color: #e0e0e0;
  border-color: #495057;
  font-size: 0.75rem;
}
.form-select-sm:focus {
  border-color: #75AADB;
  box-shadow: 0 0 0 0.15rem rgba(117, 170, 219, 0.25);
}
.form-check-input {
  background-color: #212529;
  border-color: #495057;
}
.form-check-input:checked {
  background-color: #75AADB;
  border-color: #75AADB;
}
.btn-outline-secondary {
  color: #9ca3af;
  border-color: #495057;
}
.btn-outline-secondary:hover {
  color: #e0e0e0;
  border-color: #75AADB;
  background: rgba(117, 170, 219, 0.1);
}
</style>
