<template>
  <div class="file-preview-panel d-flex flex-column h-100">
    <div v-if="!filePath" class="preview-placeholder d-flex flex-column align-items-center justify-content-center flex-grow-1 text-secondary small px-3 text-center">
      <span>Seleccione un archivo para previsualizar</span>
    </div>
    <template v-else-if="isTooLarge">
      <div class="preview-header small text-muted px-2 py-1 flex-shrink-0 text-truncate">
        {{ fileName }}
      </div>
      <div class="d-flex flex-column align-items-center justify-content-center flex-grow-1 text-secondary small px-3 text-center">
        <span>El archivo es demasiado grande para la vista previa (máx. {{ maxSizeKb }} KB)</span>
      </div>
    </template>
    <template v-else-if="isMarkdown">
      <div class="preview-header small text-muted px-2 py-1 flex-shrink-0 text-truncate d-flex align-items-center justify-content-between">
        <span class="text-truncate">{{ fileName }}</span>
        <span>
          <button class="btn btn-sm btn-outline-secondary border-0 py-0" style="font-size: 0.65rem;" @click="loadPreview" title="Recargar vista previa">
            <svg xmlns="http://www.w3.org/2000/svg" width="12" height="12" fill="currentColor" viewBox="0 0 16 16" style="margin-right: 2px;"><path fill-rule="evenodd" d="M8 3a5 5 0 1 0 4.546 2.914.5.5 0 0 1 .908-.417A6 6 0 1 1 8 2z"/><path d="M8 4.466V.534a.25.25 0 0 1 .41-.192l2.36 1.966c.12.1.12.284 0 .384L8.41 4.658A.25.25 0 0 1 8 4.466"/></svg> Recargar
          </button>
          <button v-if="canCopy" class="btn btn-sm btn-outline-secondary border-0 py-0" style="font-size: 0.65rem;" @click="copyToClipboard" title="Copiar contenido">
            <svg xmlns="http://www.w3.org/2000/svg" width="12" height="12" fill="currentColor" viewBox="0 0 16 16" style="margin-right: 2px;"><path d="M4 1.5H3a2 2 0 0 0-2 2V14a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2V3.5a2 2 0 0 0-2-2h-1v1h1a1 1 0 0 1 1 1V14a1 1 0 0 1-1 1H3a1 1 0 0 1-1-1V3.5a1 1 0 0 1 1-1h1v-1z"/><path d="M9.5 1a.5.5 0 0 1 .5.5v1a.5.5 0 0 1-.5.5h-3a.5.5 0 0 1-.5-.5v-1a.5.5 0 0 1 .5-.5h3zm-3-1A1.5 1.5 0 0 0 5 1.5v1A1.5 1.5 0 0 0 6.5 4h3A1.5 1.5 0 0 0 11 2.5v-1A1.5 1.5 0 0 0 9.5 0h-3z"/></svg> Copiar
          </button>
        </span>
      </div>
      <div class="preview-content markdown-preview flex-grow-1 overflow-y-auto px-3 py-2" style="min-height: 0;">
        <div v-if="loading" class="d-flex align-items-center justify-content-center text-secondary small py-4">
          Cargando vista previa…
        </div>
        <div v-else-if="error" class="text-danger small py-2">
          {{ error }}
        </div>
        <ChatFormatter v-else :text="content" />
      </div>
    </template>
    <template v-else-if="isCodeFile">
      <div class="preview-header small text-muted px-2 py-1 flex-shrink-0 text-truncate d-flex align-items-center justify-content-between">
        <span class="text-truncate">{{ fileName }}</span>
        <span>
          <button v-if="canCopy" class="btn btn-sm btn-outline-secondary border-0 py-0" style="font-size: 0.65rem;" @click="copyToClipboard" title="Copiar contenido">
            <svg xmlns="http://www.w3.org/2000/svg" width="12" height="12" fill="currentColor" viewBox="0 0 16 16" style="margin-right: 2px;"><path d="M4 1.5H3a2 2 0 0 0-2 2V14a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2V3.5a2 2 0 0 0-2-2h-1v1h1a1 1 0 0 1 1 1V14a1 1 0 0 1-1 1H3a1 1 0 0 1-1-1V3.5a1 1 0 0 1 1-1h1v-1z"/><path d="M9.5 1a.5.5 0 0 1 .5.5v1a.5.5 0 0 1-.5.5h-3a.5.5 0 0 1-.5-.5v-1a.5.5 0 0 1 .5-.5h3zm-3-1A1.5 1.5 0 0 0 5 1.5v1A1.5 1.5 0 0 0 6.5 4h3A1.5 1.5 0 0 0 11 2.5v-1A1.5 1.5 0 0 0 9.5 0h-3z"/></svg> Copiar
          </button>
          <span class="badge bg-secondary ms-1" style="font-size: 0.6rem;">código</span>
        </span>
      </div>
      <div class="preview-content code-preview flex-grow-1 overflow-y-auto px-0 py-0" style="min-height: 0;">
        <div v-if="loading" class="d-flex align-items-center justify-content-center text-secondary small py-4">
          <span>Cargando vista previa…</span>
        </div>
        <div v-else-if="error" class="text-danger small py-2 px-2">
          {{ error }}
        </div>
        <pre v-else class="code-pre m-0"><code class="hljs" v-html="highlightedCode"></code></pre>
      </div>
    </template>
    <template v-else-if="isCsv">
      <div class="preview-header small text-muted px-2 py-1 flex-shrink-0 text-truncate d-flex align-items-center justify-content-between">
        <span class="text-truncate">{{ fileName }}</span>
      </div>
      <div v-if="csvLoading" class="d-flex align-items-center justify-content-center text-secondary small py-4">
        Cargando vista previa CSV…
      </div>
      <div v-else-if="csvError" class="d-flex flex-column align-items-center justify-content-center text-danger small px-3 py-3">
        <span>{{ csvError }}</span>
        <button class="btn btn-sm btn-outline-secondary mt-2" @click="loadPreview">Reintentar</button>
      </div>
      <template v-else>
        <div class="csv-controls d-flex flex-wrap align-items-center gap-2 px-2 py-1 flex-shrink-0" style="background: #1a1a2e; border-bottom: 1px solid #374151;">
          <div class="d-flex align-items-center gap-1">
            <label class="small text-muted" style="white-space: nowrap; font-size: 0.65rem;">Delimitador:</label>
            <select class="form-select form-select-sm" v-model="csvDelimiter" style="width: 90px;" @change="reparseCsv">
              <option value=",">Coma (,)</option>
              <option value=";">Punto y coma (;)</option>
              <option value="	">Tabulador</option>
              <option value="|">Pipe (|)</option>
            </select>
          </div>
          <div class="d-flex align-items-center gap-1">
            <label class="small text-muted" style="white-space: nowrap; font-size: 0.65rem;">Calificador:</label>
            <select class="form-select form-select-sm" v-model="csvQuoteChar" style="width: 80px;" @change="reparseCsv">
              <option value='"'>""</option>
              <option value="'">''</option>
            </select>
          </div>
          <div class="form-check form-check-inline mb-0">
            <input class="form-check-input" type="checkbox" id="previewHasHeader" v-model="csvHasHeader" @change="reparseCsv" style="transform: scale(0.8);">
            <label class="form-check-label small text-muted" for="previewHasHeader" style="font-size: 0.65rem;">Header</label>
          </div>
          <span class="text-muted small ms-auto" style="font-size: 0.65rem;">{{ csvColumns.length }} col · {{ csvTotalRows }} filas</span>
        </div>
        <div class="csv-table-wrapper overflow-auto flex-grow-1" style="min-height: 0;">
          <table class="table table-sm table-dark table-bordered mb-0" style="font-size: 0.65rem;">
            <thead v-if="csvColumns.length > 0">
              <tr>
                <th class="text-center" style="width: 24px; color: #6b7280;">#</th>
                <th v-for="(col, ci) in csvColumns" :key="ci" class="text-nowrap" style="color: #75AADB;">{{ col }}</th>
              </tr>
            </thead>
            <tbody>
              <tr v-for="(row, ri) in csvPreviewRows" :key="ri">
                <td class="text-center text-muted" style="font-size: 0.6rem;">{{ ri + 1 }}</td>
                <td v-for="(cell, ci) in row" :key="ci" class="text-nowrap">{{ cell }}</td>
              </tr>
            </tbody>
          </table>
          <div v-if="csvPreviewRows.length < csvTotalRows" class="text-muted small text-center py-2" style="font-size: 0.65rem;">
            Mostrando {{ csvPreviewRows.length }} de {{ csvTotalRows }} filas
          </div>
          <div v-if="csvColumns.length === 0 && !csvLoading" class="text-muted small text-center p-3" style="font-size: 0.65rem;">
            No se pudieron parsear filas. Revise los parámetros de parseo.
          </div>
        </div>
        <div class="d-flex align-items-center px-2 py-1 flex-shrink-0" style="background: #1a1a2e; border-top: 1px solid #374151;">
          <button class="btn btn-sm btn-outline-secondary ms-auto" style="font-size: 0.65rem;" @click="openCsvDetail">Ver detalle</button>
        </div>
      </template>
    </template>
    <template v-else>
      <div class="preview-header small text-muted px-2 py-1 flex-shrink-0 text-truncate">
        {{ fileName }}
      </div>
      <div class="d-flex flex-column align-items-center justify-content-center flex-grow-1 text-secondary small px-3 text-center">
        <span>Vista previa solo disponible para archivos .md, código y .csv</span>
      </div>
    </template>
  </div>
</template>

<script>
import { ref, watch, computed } from 'vue'
import hljs from 'highlight.js'
import 'highlight.js/styles/atom-one-dark.css'
import ChatFormatter from '../chat/ChatFormatter.vue'
import { useSettingsStore } from '../../stores/settings.js'
import { useModalStore } from '../../stores/modal.js'
import { useCsvParser } from '../../composables/useCsvParser.js'
import CsvViewerModal from './CsvViewerModal.vue'

const EXT_TO_LANG = {
  js: 'javascript', jsx: 'javascript', mjs: 'javascript', cjs: 'javascript',
  ts: 'typescript', tsx: 'typescript',
  vue: 'vue',
  py: 'python',
  php: 'php',
  java: 'java',
  rb: 'ruby',
  go: 'go',
  rs: 'rust',
  c: 'c', cpp: 'cpp', h: 'c', hpp: 'cpp',
  cs: 'csharp',
  swift: 'swift',
  kt: 'kotlin',
  scala: 'scala',
  sh: 'bash', bash: 'bash', zsh: 'bash',
  pl: 'perl',
  lua: 'lua',
  r: 'r',
  css: 'css', scss: 'scss', less: 'less', sass: 'scss',
  html: 'xml', xml: 'xml', svg: 'xml',
  sql: 'sql',
  yml: 'yaml', yaml: 'yaml',
  json: 'json',
  md: 'markdown',
  txt: 'plaintext',
  conf: 'plaintext', cfg: 'plaintext', ini: 'ini',
  env: 'plaintext', gitignore: 'plaintext',
  dockerfile: 'dockerfile',
}

export default {
  components: { ChatFormatter },
  props: {
    filePath: { type: String, default: null },
  },
  setup(props) {
    const settings = useSettingsStore()
    const content = ref('')
    const loading = ref(false)
    const error = ref(null)

    const maxSizeKb = computed(() => {
      return parseInt(settings.codeFileMaxSizeKb, 10) || 100
    })

    const fileName = computed(() => {
      if (!props.filePath) return ''
      return props.filePath.split('/').pop() || props.filePath
    })

    const fileExtension = computed(() => {
      if (!props.filePath) return ''
      const name = props.filePath.split('/').pop() || props.filePath
      const dotIdx = name.lastIndexOf('.')
      if (dotIdx === -1) return ''
      return name.slice(dotIdx + 1).toLowerCase()
    })

    const isMarkdown = computed(() => {
      return props.filePath ? props.filePath.toLowerCase().endsWith('.md') : false
    })

    const codeExtensions = computed(() => {
      const raw = settings.codeFileExtensions || '.js,.jsx,.ts,.tsx,.vue,.py,.php,.java,.rb,.go,.rs,.c,.cpp,.h,.hpp,.cs,.swift,.kt,.scala,.sh,.bash,.pl,.lua,.r,.m,.mm,.css,.scss,.less,.sass,.html,.sql,.json'
      return raw.split(',').map(e => e.trim().replace(/^\./, '').toLowerCase()).filter(Boolean)
    })

    const isCodeFile = computed(() => {
      if (!props.filePath || isMarkdown.value) return false
      if (isEnv.value) return true
      return codeExtensions.value.includes(fileExtension.value)
    })

    const isEnv = computed(() => {
      if (!props.filePath) return false
      const name = props.filePath.split('/').pop() || props.filePath
      return /^\.env$|^\.env\.[a-zA-Z0-9_-]{1,8}$/.test(name)
    })

    const isCsv = computed(() => {
      return props.filePath ? props.filePath.toLowerCase().endsWith('.csv') : false
    })

    const detectedLanguage = computed(() => {
      if (isEnv.value) return 'plaintext'
      const ext = fileExtension.value
      return EXT_TO_LANG[ext] || null
    })

    const canCopy = computed(() => {
      const ext = fileExtension.value
      return ext === 'md' || ext === 'js'
    })

    function copyToClipboard() {
      navigator.clipboard.writeText(content.value).catch(err => {
        console.error('Error al copiar al portapapeles:', err)
      })
    }

    const modal = useModalStore()
    const { parseCsv: parseCsvRaw } = useCsvParser()

    const csvRawContent = ref('')
    const csvLoading = ref(false)
    const csvError = ref(null)
    const csvDelimiter = ref(',')
    const csvQuoteChar = ref('"')
    const csvHasHeader = ref(true)
    const csvColumns = ref([])
    const csvRows = ref([])

    const csvTotalRows = computed(() => csvRows.value.length)
    const MAX_PREVIEW_ROWS = 30
    const csvPreviewRows = computed(() => csvRows.value.slice(0, MAX_PREVIEW_ROWS))

    function reparseCsv() {
      const result = parseCsvRaw(csvRawContent.value, csvDelimiter.value, csvQuoteChar.value, csvHasHeader.value)
      csvColumns.value = result.columns
      csvRows.value = result.rows
    }

    function openCsvDetail() {
      modal.open(CsvViewerModal, { filePath: props.filePath }, { title: `CSV: ${fileName.value}`, wide: true })
    }

    const isTooLarge = computed(() => {
      if (!content.value || !isCodeFile.value) return false
      const maxBytes = maxSizeKb.value * 1024
      return content.value.length > maxBytes
    })

    const highlightedCode = computed(() => {
      if (!content.value || !isCodeFile.value || isTooLarge.value) return ''
      try {
        const lang = detectedLanguage.value
        if (lang) {
          return hljs.highlight(content.value, { language: lang }).value
        }
        return hljs.highlightAuto(content.value).value
      } catch (err) {
        console.error('Error resaltando código:', err)
        return escapeHtml(content.value)
      }
    })

    function escapeHtml(str) {
      const div = document.createElement('div')
      div.textContent = str
      return div.innerHTML
    }

    async function loadPreview() {
      if (!props.filePath) {
        content.value = ''
        error.value = null
        csvRawContent.value = ''
        csvRows.value = []
        csvColumns.value = []
        return
      }
      if (isCsv.value) {
        csvLoading.value = true
        csvError.value = null
        try {
          const res = await fetch(`/api/command/read-file?path=${encodeURIComponent(props.filePath)}`, {
            credentials: 'include',
          })
          const data = await res.json()
          if (data.success) {
            csvRawContent.value = data.content
            reparseCsv()
          } else {
            csvError.value = data.error || 'Error al leer el archivo'
          }
        } catch (err) {
          csvError.value = err.message || 'Error de conexión'
        } finally {
          csvLoading.value = false
        }
        return
      }
      if (!isMarkdown.value && !isCodeFile.value) {
        content.value = ''
        error.value = null
        return
      }
      loading.value = true
      error.value = null
      try {
        const res = await fetch(`/api/command/read-file?path=${encodeURIComponent(props.filePath)}`, {
          credentials: 'include',
        })
        const data = await res.json()
        if (data.success) {
          content.value = data.content
        } else {
          error.value = data.error || 'Error al leer el archivo'
        }
      } catch (err) {
        error.value = err.message || 'Error de conexión'
      } finally {
        loading.value = false
      }
    }

    watch(() => props.filePath, () => {
      loadPreview()
    })

    return { content, loading, error, fileName, isMarkdown, isCodeFile, isCsv, canCopy, copyToClipboard, isTooLarge, maxSizeKb, highlightedCode, loadPreview, csvLoading, csvError, csvDelimiter, csvQuoteChar, csvHasHeader, csvColumns, csvRows, csvTotalRows, csvPreviewRows, reparseCsv, openCsvDetail }
  },
}
</script>

<style scoped>
.file-preview-panel {
  font-size: 0.75rem;
  color: #d1d5db;
  min-height: 0;
  overflow: hidden;
  border-left: 1px solid #374151;
}
.preview-header {
  border-bottom: 1px solid #374151;
  white-space: nowrap;
  color: #9ca3af;
}
.preview-content {
  background: #16213e;
}
.preview-placeholder {
  background: #16213e;
}
.code-preview {
  background: #1d1f27;
}
.code-pre {
  font-size: 0.7rem;
  line-height: 1.5;
}
.code-pre :deep(.hljs) {
  background: transparent;
  padding: 8px;
  overflow-x: auto;
}
.markdown-preview {
  font-size: 0.8rem;
  line-height: 1.5;
  color: #c9d1d9;
}
.csv-controls {
  font-size: 0.65rem;
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
  padding: 2px 6px;
  border-color: #30363d;
  white-space: nowrap;
}
.csv-table-wrapper tbody tr:hover {
  background: rgba(117, 170, 219, 0.06);
}
</style>
