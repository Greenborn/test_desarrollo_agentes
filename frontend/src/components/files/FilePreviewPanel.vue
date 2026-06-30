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
        <button v-if="canCopy" class="btn btn-sm btn-outline-secondary border-0 py-0" style="font-size: 0.65rem;" @click="copyToClipboard" title="Copiar contenido">
          <svg xmlns="http://www.w3.org/2000/svg" width="12" height="12" fill="currentColor" viewBox="0 0 16 16" style="margin-right: 2px;"><path d="M4 1.5H3a2 2 0 0 0-2 2V14a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2V3.5a2 2 0 0 0-2-2h-1v1h1a1 1 0 0 1 1 1V14a1 1 0 0 1-1 1H3a1 1 0 0 1-1-1V3.5a1 1 0 0 1 1-1h1v-1z"/><path d="M9.5 1a.5.5 0 0 1 .5.5v1a.5.5 0 0 1-.5.5h-3a.5.5 0 0 1-.5-.5v-1a.5.5 0 0 1 .5-.5h3zm-3-1A1.5 1.5 0 0 0 5 1.5v1A1.5 1.5 0 0 0 6.5 4h3A1.5 1.5 0 0 0 11 2.5v-1A1.5 1.5 0 0 0 9.5 0h-3z"/></svg> Copiar
        </button>
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
    <template v-else>
      <div class="preview-header small text-muted px-2 py-1 flex-shrink-0 text-truncate">
        {{ fileName }}
      </div>
      <div class="d-flex flex-column align-items-center justify-content-center flex-grow-1 text-secondary small px-3 text-center">
        <span>Vista previa solo disponible para archivos .md y código</span>
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
      const raw = settings.codeFileExtensions || '.js,.jsx,.ts,.tsx,.vue,.py,.php,.java,.rb,.go,.rs,.c,.cpp,.h,.hpp,.cs,.swift,.kt,.scala,.sh,.bash,.pl,.lua,.r,.m,.mm,.css,.scss,.less,.sass,.html,.sql'
      return raw.split(',').map(e => e.trim().replace(/^\./, '').toLowerCase()).filter(Boolean)
    })

    const isCodeFile = computed(() => {
      if (!props.filePath || isMarkdown.value) return false
      return codeExtensions.value.includes(fileExtension.value)
    })

    const detectedLanguage = computed(() => {
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
      if (!props.filePath || (!isMarkdown.value && !isCodeFile.value)) {
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

    return { content, loading, error, fileName, isMarkdown, isCodeFile, canCopy, copyToClipboard, isTooLarge, maxSizeKb, highlightedCode }
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
</style>
