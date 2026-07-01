<template>
  <div class="descripcion-mejorar-modal d-flex flex-column" style="height: 100%; min-height: 0;">
    <div class="d-flex flex-grow-1" style="min-height: 0;">
      <!-- LEFT PANEL: cols 1+2 (top half) + OC chat (bottom half) -->
      <div class="d-flex flex-column flex-shrink-0" :style="{ width: leftPanelWidth + 'px', minWidth: (COL1_MIN + COL2_MIN + 6) + 'px' }">
        <!-- TOP HALF: col1 + splitter + col2 -->
        <div class="d-flex" style="height: 50%; min-height: 0;">
          <div
            class="d-flex flex-column flex-shrink-0"
            :style="{ width: col1Width + 'px', minWidth: COL1_MIN + 'px' }"
          >
            <div class="d-flex align-items-center gap-1 px-2 py-1 flex-shrink-0" style="border-bottom: 1px solid #374151;">
              <button class="btn btn-xs py-0 px-1" style="font-size: 0.55rem; line-height: 1.2;" title="Agregar nota" @click="abrirCrear">+</button>
              <span class="small text-secondary" style="font-size: 0.65rem;">Docs</span>
              <div class="btn-group btn-group-xs ms-auto" style="font-size: 0.6rem;">
                <button
                  class="btn btn-xs py-0 px-1"
                  :class="filterMode === 'project' ? 'btn-argentina' : 'btn-outline-secondary'"
                  @click="filterMode = 'project'"
                >Proyecto</button>
                <button
                  class="btn btn-xs py-0 px-1"
                  :class="filterMode === 'ticket' ? 'btn-argentina' : 'btn-outline-secondary'"
                  @click="filterMode = 'ticket'"
                  :disabled="!ticketId"
                >Ticket</button>
              </div>
            </div>
            <div class="overflow-y-auto flex-grow-1" style="min-height: 0;">
              <div
                v-for="n in filteredNotas"
                :key="n.id"
                class="doc-item px-2 py-1"
                :class="{ selected: selectedDoc?.id === n.id }"
                @click="selectedDoc = n"
              >
                <div class="d-flex justify-content-between align-items-center gap-1">
                  <span class="doc-clave text-truncate small flex-grow-1" style="font-size: 0.7rem;">{{ n.clave }}</span>
                  <div class="d-flex align-items-center gap-1">
                    <button
                      class="btn btn-xs py-0 px-1"
                      style="font-size: 0.55rem; line-height: 1.2;"
                      @click.stop="toggleSelectDoc(n)"
                      :title="isDocSelected(n) ? 'Quitar de seleccionadas' : 'Seleccionar'"
                    >{{ isDocSelected(n) ? '✓' : 'Sel' }}</button>
                    <button
                      class="btn btn-xs py-0 px-1"
                      style="font-size: 0.55rem; line-height: 1.2;"
                      @click.stop="verDetalle(n)"
                    >Ver</button>
                    <button
                      class="doc-item-delete-btn"
                      title="Eliminar nota"
                      @click.stop="eliminarNota(n)"
                    >×</button>
                  </div>
                </div>
                <div class="text-muted" style="font-size: 0.55rem;">{{ n.id_ticket ? '#' + n.id_ticket : 'General' }}</div>
              </div>
              <div v-if="filteredNotas.length === 0" class="text-secondary small text-center py-4 px-2">
                {{ loadingNotas ? 'Cargando...' : 'Sin documentación' }}
              </div>
            </div>
          </div>

          <div class="desc-splitter" @mousedown.prevent="onCol1SplitStart"></div>

          <div
            class="d-flex flex-column flex-shrink-0"
            :style="{ width: col2Width + 'px', minWidth: COL2_MIN + 'px' }"
          >
            <div class="small text-secondary px-2 py-1 flex-shrink-0" style="border-bottom:1px solid #374151;font-size:0.65rem;">Seleccionadas ({{ selectedNotas.length }})</div>
            <div class="overflow-y-auto flex-grow-1" style="min-height:0;">
              <div
                v-for="n in selectedNotas"
                :key="n.id"
                class="doc-item px-2 py-1"
              >
                <div class="d-flex justify-content-between align-items-center gap-1">
                  <span class="doc-clave text-truncate small flex-grow-1" style="font-size:0.7rem;">{{ n.clave }}</span>
                  <button
                    class="btn btn-xs py-0 px-1"
                    style="font-size:0.55rem;line-height:1.2;"
                    @click.stop="toggleSelectDoc(n)"
                    title="Quitar de seleccionadas"
                  >×</button>
                </div>
                <div class="text-muted" style="font-size:0.55rem;">{{ n.id_ticket ? '#' + n.id_ticket : 'General' }}</div>
              </div>
              <div v-if="selectedNotas.length === 0" class="text-secondary small text-center py-4 px-2">Sin selección</div>
            </div>
          </div>
        </div>

        <!-- RESIZE HANDLE (horizontal) -->
        <div class="desc-row-splitter" @mousedown.prevent="onLeftSplitStart"></div>

        <!-- BOTTOM HALF: OpenCode chat -->
        <div class="d-flex flex-column" style="height: 50%; min-height: 0;">
          <div class="small fw-semibold text-secondary px-2 py-1 flex-shrink-0" style="border-bottom:1px solid #374151;font-size:0.65rem;">
            OpenCode
            <span v-if="ocAgentLinked" class="text-success ms-1" style="font-size:0.55rem;">✓ activo</span>
            <span v-else class="text-muted ms-1" style="font-size:0.55rem;">— inactivo</span>
          </div>
          <div v-if="!ocAgentLinked" class="d-flex align-items-center justify-content-center flex-grow-1">
            <button class="btn btn-sm btn-outline-argentina py-1 px-3" style="font-size:0.7rem;" @click="iniciarOpencode">🚀 Iniciar OpenCode</button>
          </div>
          <template v-else>
            <div class="overflow-y-auto flex-grow-1 px-2 py-1" style="min-height:0;background:#0f172a;" ref="ocChatRef">
              <div v-for="m in ocMessages" :key="m._key || m.id" class="mb-2">
                <div v-if="m.role === 'opencode_confirmed' || m.role === 'user'" class="text-end">
                  <span class="d-inline-block small px-2 py-1 rounded" style="background:#1a2744;color:#cbd5e1;font-size:0.65rem;max-width:90%;word-break:break-word;">{{ m.content }}</span>
                </div>
                <div v-else-if="m.role === 'opencode_result' || m.role === 'opencode_stream'" class="text-start">
                  <div class="small px-2 py-1" style="color:#cbd5e1;font-size:0.65rem;max-width:100%;word-break:break-word;">
                    <ChatFormatter :text="m.content" />
                    <span v-if="(m.role === 'opencode_stream' || m._streaming) && !aiResponse" class="blink" style="color:#75AADB;">▌</span>
                  </div>
                </div>
                <div v-else-if="m.role === 'opencode_info'" class="text-center">
                  <span class="small text-muted" style="font-size:0.55rem;">{{ m.content }}</span>
                </div>
              </div>
              <div v-if="ocMessages.length === 0" class="text-secondary small text-center py-4">Sin mensajes</div>
            </div>
            <div class="d-flex gap-1 p-1 flex-shrink-0" style="border-top:1px solid #374151;">
              <textarea
                v-model="ocInput"
                class="form-control form-control-sm bg-dark text-light border-secondary font-monospace"
                style="font-size:0.65rem;resize:none;min-height:28px;"
                rows="1"
                :placeholder="ocSending ? 'Enviando...' : 'Escribe un mensaje...'"
                :disabled="ocSending"
                @keydown.enter.ctrl="sendToOc"
              ></textarea>
              <button
                class="btn btn-sm btn-argentina py-0 px-2 flex-shrink-0"
                style="font-size:0.6rem;"
                @click="sendToOc"
                :disabled="!ocInput.trim() || ocSending"
              >{{ ocSending ? '...' : 'Enviar' }}</button>
            </div>
          </template>
        </div>
      </div>

      <!-- SPLITTER between left panel and right panel -->
      <div class="desc-splitter" @mousedown.prevent="onLeftPanelSplitStart"></div>

      <!-- COL 3: Mustacheables -->
      <div
        class="d-flex flex-column flex-shrink-0"
        :style="{ width: colMustacheWidth + 'px', minWidth: COL_MUSTACHE_MIN + 'px' }"
      >
        <div class="d-flex align-items-center gap-1 px-2 py-1 flex-shrink-0" style="border-bottom:1px solid #374151;">
          <span class="small text-secondary" style="font-size:0.65rem;">Mustacheables</span>
          <button
            class="btn btn-xs py-0 px-1 ms-auto"
            style="font-size:0.55rem;line-height:1.2;"
            @click="showPreviewModal = true"
            :disabled="previewDocs.length === 0"
          >Vista previa</button>
        </div>
        <div class="overflow-y-auto flex-grow-1" style="min-height:0;">
          <div v-for="key in mustacheKeys" :key="key" class="px-2 py-1" style="border-bottom:1px solid #2d3748;">
            <div class="small text-secondary" style="font-size:0.6rem;" v-text="'{{' + key + '}}'"></div>
            <input
              v-model="mustacheValues[key]"
              class="form-control form-control-sm bg-dark text-light border-secondary font-monospace"
              style="font-size:0.7rem;padding:2px 6px;"
              :placeholder="key"
            />
          </div>
          <div v-if="mustacheKeys.length === 0" class="text-secondary small text-center py-4 px-2">Sin variables</div>
        </div>
      </div>

      <!-- SPLITTER 3 -->
      <div class="desc-splitter" @mousedown.prevent="onMustacheSplitStart"></div>

      <!-- COL 4: Inputs -->
      <div class="d-flex flex-column gap-2 flex-grow-1" style="min-width: 50px; min-height: 0;">
        <label class="form-label small mb-0" style="color: #9ca3af;">Objetivo</label>
        <textarea
          v-model="objetivo"
          class="form-control bg-dark text-light border-secondary font-monospace"
          rows="2"
          style="resize: vertical; flex-shrink: 0;"
          placeholder="Opcional. Si se deja vacío se genera automáticamente desde las notas de reunión"
        ></textarea>

        <label class="form-label small mb-0 mt-1" style="color: #9ca3af;">Notas de reunión</label>
        <textarea
          v-model="notasReunion"
          class="form-control bg-dark text-light border-secondary font-monospace"
          rows="2"
          style="resize: vertical; flex-shrink: 0;"
          placeholder="Pega aquí las notas de la reunión"
        ></textarea>

        <label class="form-label small mb-0 mt-1" style="color: #9ca3af;">Texto adicional (opcional)</label>
        <textarea
          v-model="textoAdicional"
          class="form-control bg-dark text-light border-secondary font-monospace flex-grow-1"
          rows="4"
          style="resize: vertical; min-height: 60px;"
          placeholder="Datos adicionales para el prompt del agente"
        ></textarea>

        <button
          class="btn btn-sm btn-argentina mt-1 align-self-start flex-shrink-0"
          @click="generar"
          :disabled="loading || !notasReunion.trim()"
        >
          <span v-if="loading" class="spinner-border spinner-border-sm me-1" role="status"></span>
          {{ loading ? 'Generando...' : '↻ Generar' }}
        </button>
      </div>

      <!-- SPLITTER 4 -->
      <div class="desc-splitter" @mousedown.prevent="onResultSplitStart"></div>

      <!-- COL 5: Result -->
      <div
        class="d-flex flex-column flex-shrink-0"
        :style="{ width: colResultWidth + 'px', minWidth: COL_RESULT_MIN + 'px' }"
      >
        <div class="d-flex justify-content-between align-items-center flex-shrink-0">
          <label class="form-label small mb-0" style="color: #9ca3af;">
            Respuesta
            <span v-if="aiResponse" class="text-success ms-1" style="font-size: 0.65rem;">({{ aiResponse.length }} caracteres)</span>
          </label>
          <div v-if="response" class="d-flex gap-1">
            <button
              class="btn btn-sm"
              :class="viewMode === 'rendered' ? 'btn-argentina' : 'btn-outline-secondary'"
              @click="viewMode = 'rendered'"
              style="font-size: 0.7rem; line-height: 1; padding: 2px 6px;"
            >Vista previa</button>
            <button
              class="btn btn-sm"
              :class="viewMode === 'raw' ? 'btn-argentina' : 'btn-outline-secondary'"
              @click="viewMode = 'raw'"
              style="font-size: 0.7rem; line-height: 1; padding: 2px 6px;"
            >Texto plano</button>
            <button
              class="btn btn-sm btn-outline-secondary"
              @click="copiarTexto"
              title="Copiar texto plano"
              style="font-size: 0.7rem; line-height: 1; padding: 2px 6px;"
            >📋</button>
            <span class="text-secondary mx-1" style="opacity: 0.3;">|</span>
            <button
              class="btn btn-sm btn-outline-secondary"
              @click="disminuirFont"
              title="Reducir tamaño de letra"
              style="font-size: 0.7rem; line-height: 1; padding: 2px 6px;"
            >A⁻</button>
            <span style="font-size: 0.7rem; color: #9ca3af; min-width: 22px; text-align: center;">{{ fontSize }}</span>
            <button
              class="btn btn-sm btn-outline-secondary"
              @click="aumentarFont"
              title="Aumentar tamaño de letra"
              style="font-size: 0.7rem; line-height: 1; padding: 2px 6px;"
            >A⁺</button>
          </div>
        </div>
        <div
          class="flex-grow-1 border border-secondary rounded mt-1"
          style="overflow-y: auto; overflow-x: hidden; min-height: 0; background: #1a1d21; word-break: break-word; overflow-wrap: break-word; max-width: 100%;"
        >
          <div v-if="!response && loading" class="p-2" style="min-height: 80px; color: #6c757d;">Esperando respuesta...</div>
          <div v-else-if="!response && !loading" class="p-2" style="min-height: 80px;"></div>
          <div v-else-if="viewMode === 'rendered'" class="p-2" :style="{ fontSize: fontSize + 'px', minHeight: '80px' }">
            <ChatFormatter :text="response" />
          </div>
          <pre v-else class="m-0 p-2" :style="{ fontSize: fontSize + 'px', whiteSpace: 'pre-wrap', wordBreak: 'break-word', overflowWrap: 'break-word', overflow: 'hidden', maxWidth: '100%', minHeight: '80px', color: '#e0e0e0', background: 'transparent', border: 'none' }">{{ response }}</pre>
        </div>
        <span v-if="loading && !response" class="blink" style="color: #75AADB;">▌</span>
      </div>
    </div>

    <!-- Footer -->
    <div class="d-flex gap-2 justify-content-end pt-2 border-top border-secondary mt-2 flex-shrink-0">
      <button
        class="btn btn-sm btn-argentina"
        @click="aplicar"
        :disabled="!aiResponse || loading"
      >✓ Aplicar cambios</button>
      <button class="btn btn-sm btn-outline-argentina" @click="cancelar">Cancelar</button>
    </div>

    <!-- PREVIEW DOCS MODAL OVERLAY -->
    <div v-if="showPreviewModal" class="desc-doc-modal-overlay" @click.self="showPreviewModal = false">
      <div class="bg-dark rounded" style="width:600px;max-width:90vw;max-height:80vh;border:1px solid #374151;display:flex;flex-direction:column;" @click.stop>
        <div class="d-flex justify-content-between align-items-center px-3 py-1 flex-shrink-0" style="border-bottom:1px solid #374151;">
          <span class="small fw-semibold text-light">Vista previa ({{ previewDocs.length }} documentaciones)</span>
          <div class="d-flex align-items-center gap-1">
            <button class="btn btn-xs py-0 px-1" style="font-size:0.6rem;line-height:1.2;" :class="previewViewMode === 'rendered' ? 'btn-argentina' : 'btn-outline-secondary'" @click="previewViewMode = 'rendered'">MD</button>
            <button class="btn btn-xs py-0 px-1" style="font-size:0.6rem;line-height:1.2;" :class="previewViewMode === 'raw' ? 'btn-argentina' : 'btn-outline-secondary'" @click="previewViewMode = 'raw'">Texto</button>
            <button class="btn btn-xs py-0 px-1" style="font-size:0.6rem;line-height:1.2;" @click="copiarPreview" title="Copiar texto plano">📋</button>
            <button class="btn btn-sm btn-outline-secondary py-0 px-2" style="font-size:0.65rem;" @click="showPreviewModal = false">Cerrar</button>
          </div>
        </div>
        <div class="overflow-y-auto flex-grow-1 p-2" style="min-height:0;">
          <div v-for="(doc, idx) in previewDocs" :key="idx" class="mb-3" style="border-bottom:1px solid #374151;">
            <div class="small fw-semibold text-light mb-1" style="font-size:0.75rem;">{{ doc.clave }}</div>
            <div v-if="previewViewMode === 'rendered'" class="p-1"><ChatFormatter :text="doc.valor" /></div>
            <pre v-else class="m-0 small" style="white-space:pre-wrap;word-break:break-word;color:#cbd5e1;font-size:0.7rem;background:transparent;border:none;">{{ doc.valor }}</pre>
          </div>
          <div v-if="previewDocs.length === 0" class="text-secondary small text-center py-4">Sin documentaciones seleccionadas</div>
        </div>
      </div>
    </div>

    <!-- DOC/NOTA CREATE/EDIT MODAL OVERLAY -->
    <div v-if="showDocModal" class="desc-doc-modal-overlay" @click.self="closeDocModal">
      <div class="desc-doc-modal bg-dark rounded" style="width:95vw;max-width:1200px;height:90vh;border:1px solid #374151;display:flex;flex-direction:column;" @click.stop>
        <div class="d-flex align-items-center gap-2 px-3 py-1 flex-shrink-0" style="border-bottom:1px solid #374151;">
          <div class="d-flex flex-column flex-grow-1" style="min-width:0;">
            <div class="d-flex align-items-center gap-2">
              <input
                ref="editClaveInput"
                v-model="editClave"
                class="bg-transparent border-0 text-light fw-semibold font-monospace"
                style="font-size:0.8rem;outline:none;min-width:50px;color:#75AADB;"
                maxlength="255"
                placeholder="nombre_de_la_nota"
              />
              <div class="d-flex align-items-center gap-2" style="font-size:0.65rem;">
                <label class="d-flex align-items-center gap-1" style="cursor:pointer;color:#cbd5e1;">
                  <input type="radio" value="general" v-model="editTicketType" class="form-check-input m-0" :disabled="!editIsNew" /> General
                </label>
                <label class="d-flex align-items-center gap-1" style="cursor:pointer;color:#cbd5e1;">
                  <input type="radio" value="especifica" v-model="editTicketType" class="form-check-input m-0" :disabled="!editIsNew" /> Ticket #{{ ticketId }}
                </label>
              </div>
            </div>
          </div>
          <label class="d-flex align-items-center gap-1" style="cursor:pointer;font-size:0.65rem;color:#9ca3af;user-select:none;">
            <span>{{ editIsJson ? 'JSON' : 'MD' }}</span>
            <input type="checkbox" v-model="editPreviewMode" class="form-check-input m-0" style="width:14px;height:14px;cursor:pointer;" />
          </label>
          <button class="btn btn-sm btn-outline-success py-0 px-2" style="font-size:0.65rem;" @click="guardarDocEdit" :disabled="!editValor">{{ editIsNew ? 'Crear' : 'Guardar' }}</button>
          <button class="btn btn-sm btn-outline-secondary py-0 px-2" style="font-size:0.65rem;" @click="closeDocModal">Cerrar</button>
        </div>
        <div v-if="editError" class="text-danger small px-3 py-1 flex-shrink-0" style="border-bottom:1px solid #374151;">{{ editError }}</div>
        <textarea
          v-if="!editPreviewMode"
          v-model="editValor"
          class="doc-edit-textarea flex-grow-1 w-100 border-0 p-2"
          maxlength="16384"
          placeholder="Escriba la documentación aquí…"
        ></textarea>
        <div v-else-if="editIsJson" class="flex-grow-1 w-100 overflow-auto p-2" style="background:#0f172a;">
          <JsonTreeView :data="editParsedJson" />
        </div>
        <div v-else class="flex-grow-1 w-100 overflow-auto p-2" style="background:#0f172a;">
          <ChatFormatter :text="editValor" />
        </div>
        <div v-if="!editPreviewMode" class="d-flex justify-content-end px-2 py-1 flex-shrink-0" style="font-size:0.6rem;color:#6b7280;border-top:1px solid #374151;">
          <span>{{ editValor?.length || 0 }} / 16384</span>
        </div>
      </div>
    </div>
  </div>
</template>

<script>
import { ref, computed, watch, onMounted, nextTick } from 'vue'
import { useChatStore } from '../../stores/chat.js'
import { useDocumentacionNotasStore } from '../../stores/documentacionNotas.js'
import { useOpencodeStore } from '../../stores/opencode.js'
import { settingGet, settingSet } from '../../services/settingService.js'
import ChatFormatter from '../chat/ChatFormatter.vue'
import JsonTreeView from '../utils/JsonTreeView.vue'

const COL1_WIDTH_KEY = 'desc_mejorar_col_docs_width'
const COL1_MIN = 120
const COL1_DEFAULT = 200
const COL2_WIDTH_KEY = 'desc_mejorar_col_selected_width'
const COL2_MIN = 120
const COL2_DEFAULT = 180
const COL_MUSTACHE_WIDTH_KEY = 'desc_mejorar_col_mustache_width'
const COL_MUSTACHE_MIN = 140
const COL_MUSTACHE_DEFAULT = 220
const COL_RESULT_WIDTH_KEY = 'desc_mejorar_col_result_width'
const COL_RESULT_MIN = 180
const COL_RESULT_DEFAULT = 350
const FONT_SIZE_KEY = 'descripcion_modal_font_size'

async function streamRefine(text, systemPrompt, sessionId) {
  const res = await fetch('/api/chat/refine', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    credentials: 'include',
    body: JSON.stringify({ text, systemPrompt, sessionId }),
  })
  if (!res.ok) {
    let errMsg = 'Error en la consulta'
    try { const errData = await res.json(); if (errData.error) errMsg = errData.error } catch {}
    throw new Error(errMsg)
  }
  const reader = res.body.getReader()
  const decoder = new TextDecoder()
  let result = ''
  let buf = ''
  while (true) {
    const { done, value } = await reader.read()
    if (done) break
    buf += decoder.decode(value, { stream: true })
    const lines = buf.split('\n')
    buf = lines.pop() || ''
    for (const line of lines) {
      const t = line.trim()
      if (!t || !t.startsWith('data: ')) continue
      try {
        const j = JSON.parse(t.slice(6))
        if (j.type === 'response') {
          result += j.content
        } else if (j.type === 'error') {
          throw new Error(j.content)
        }
      } catch (e) {
        if (e.message && e.message !== 'Unexpected end of JSON input') throw e
      }
    }
  }
  return result
}

export default {
  components: { ChatFormatter, JsonTreeView },
  props: {
    sessionId: { type: [String, Number], default: '' },
    ticketId: { type: [String, Number], default: null },
    onApply: { type: Function, default: null },
  },
  emits: ['close'],
  setup(props, { emit }) {
    const chatStore = useChatStore()
    const docNotasStore = useDocumentacionNotasStore()

    const objetivo = ref('')
    const notasReunion = ref('')
    const textoAdicional = ref('')
    const response = ref('')
    const aiResponse = ref('')
    const loading = ref(false)
    const viewMode = ref('rendered')
    const fontSize = ref(parseInt(localStorage.getItem(FONT_SIZE_KEY), 10) || 14)
    const promptAgentePrompt = ref('')
    const objetivoPrompt = ref('')
    const plantillaDescripcion = ref('')

    const col1Width = ref(COL1_DEFAULT)
    const col2Width = ref(COL2_DEFAULT)
    const colMustacheWidth = ref(COL_MUSTACHE_DEFAULT)
    const colResultWidth = ref(COL_RESULT_DEFAULT)
    const filterMode = ref('project')

    // OpenCode chat
    const ocStore = useOpencodeStore()
    const leftPanelWidth = ref(COL1_DEFAULT + COL2_DEFAULT + 6)
    const ocInput = ref('')
    const ocSending = ref(false)
    const ocChatRef = ref(null)
    const ocAgentLinked = computed(() => {
      const map = ocStore.sessionsMap[String(props.sessionId)]
      return map && map.ocSessionId ? true : false
    })
    const ocMessages = computed(() => {
      if (!props.sessionId) return []
      return chatStore.messages.filter(m => {
        return ['opencode_confirmed', 'opencode_result', 'opencode_stream', 'opencode_info', 'opencode_control'].includes(m.role)
      })
    })

    const proyectoId = ref(null)

    // Docs
    const selectedDoc = ref(null)
    const loadingNotas = ref(false)

    // Doc create/edit modal
    const showDocModal = ref(false)
    const editIsNew = ref(false)
    const editNota = ref(null)
    const editClave = ref('')
    const editValor = ref('')
    const editPreviewMode = ref(false)
    const editTicketType = ref('general')
    const editError = ref('')
    const editClaveInput = ref(null)

    // Selected docs — stored by id with full valor loaded
    const selectedDocsMap = ref({})

    const selectedNotas = computed(() => Object.values(selectedDocsMap.value))

    // Project variables for mustache resolution
    const projectVariables = ref([])
    const mustacheValues = ref({})
    const showPreviewModal = ref(false)
    const previewViewMode = ref('rendered')

    function extractMustacheVars() {
      const vars = {}
      const varmap = {}
      for (const v of projectVariables.value) {
        varmap[v.key] = v.value
      }
      for (const nota of Object.values(selectedDocsMap.value)) {
        const re = /\{\{(\w+)\}\}/g
        let match
        while ((match = re.exec(nota.valor || '')) !== null) {
          const key = match[1]
          if (!(key in vars)) {
            vars[key] = varmap[key] !== undefined ? varmap[key] : ''
          }
        }
      }
      return vars
    }

    const mustacheKeys = computed(() => Object.keys(mustacheValues.value))

    const selectedDocsResolvedText = computed(() => {
      const parts = []
      for (const nota of Object.values(selectedDocsMap.value)) {
        let text = nota.valor || ''
        for (const [key, val] of Object.entries(mustacheValues.value)) {
          text = text.replace(new RegExp(`\\{\\{${escapeRegex(key)}\\}\\}`, 'g'), val)
        }
        parts.push(`--- ${nota.clave} ---\n${text}`)
      }
      return parts.join('\n\n')
    })

    const previewDocs = computed(() => {
      const interpolated = []
      for (const nota of Object.values(selectedDocsMap.value)) {
        let text = nota.valor || ''
        for (const [key, val] of Object.entries(mustacheValues.value)) {
          text = text.replace(new RegExp(`\\{\\{${escapeRegex(key)}\\}\\}`, 'g'), val)
        }
        interpolated.push({ clave: nota.clave, valor: text })
      }
      return interpolated
    })

    function copiarPreview() {
      const text = previewDocs.value.map(d => `=== ${d.clave} ===\n${d.valor}`).join('\n\n')
      if (!text) return
      try {
        navigator.clipboard.writeText(text)
      } catch (err) {
        console.error('Error al copiar preview:', err)
      }
    }

    function escapeRegex(str) {
      return str.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
    }

    function rebuildMustacheValues() {
      const base = extractMustacheVars()
      const current = { ...mustacheValues.value }
      const merged = {}
      for (const key of Object.keys(base)) {
        merged[key] = key in current ? current[key] : base[key]
      }
      mustacheValues.value = merged
    }

    watch([selectedDocsMap, projectVariables], rebuildMustacheValues, { deep: true })

    async function toggleSelectDoc(n) {
      const map = { ...selectedDocsMap.value }
      if (map[n.id]) {
        delete map[n.id]
        selectedDocsMap.value = map
      } else {
        try {
          const full = await docNotasStore.getNota(proyectoId.value, n.clave)
          map[n.id] = full || { ...n, valor: '' }
        } catch (err) {
          console.error('Error al cargar nota completa:', err)
          map[n.id] = { ...n, valor: '' }
        }
        selectedDocsMap.value = map
      }
    }

    function isDocSelected(n) {
      return !!selectedDocsMap.value[n.id]
    }

    const allNotas = computed(() => {
      const pid = proyectoId.value
      return pid ? (docNotasStore.notasByProject[pid] || []) : []
    })

    const filteredNotas = computed(() => {
      if (!props.ticketId || filterMode.value === 'project') {
        return allNotas.value
      }
      return allNotas.value.filter(n => Number(n.id_ticket) === Number(props.ticketId))
    })

    const editParsedJson = computed(() => {
      if (!editValor.value) return null
      try {
        return JSON.parse(editValor.value)
      } catch {
        return null
      }
    })
    const editIsJson = computed(() => editParsedJson.value !== null && typeof editParsedJson.value === 'object')

    async function loadProyectoId() {
      if (!props.sessionId) return
      const session = chatStore.sessions.find(s => Number(s.id) === Number(props.sessionId))
      if (session && session.proyecto_id) {
        proyectoId.value = session.proyecto_id
        return
      }
      try {
        const res = await fetch(`/api/proyecto/session/${encodeURIComponent(props.sessionId)}`, { credentials: 'include' })
        if (res.ok) {
          const data = await res.json()
          proyectoId.value = data.proyectoId || null
        }
      } catch (err) {
        console.error('Error al cargar proyecto de sesión:', err)
      }
    }

    async function loadNotas() {
      if (!proyectoId.value) return
      loadingNotas.value = true
      try {
        await docNotasStore.loadNotas(proyectoId.value)
      } catch (err) {
        console.error('Error al cargar notas:', err)
      } finally {
        loadingNotas.value = false
      }
    }

    async function loadProjectVars() {
      if (!proyectoId.value) return
      try {
        const auth = (await import('../../stores/auth.js')).useAuthStore()
        const wsClient = (await import('../../services/wsClient.js')).default
        const data = await wsClient.send('proyectoVarListar', {
          sessionToken: auth.getSessionToken(),
          proyectoId: proyectoId.value,
        })
        projectVariables.value = data.variables || []
      } catch (err) {
        console.error('Error al cargar variables del proyecto:', err)
        projectVariables.value = []
      }
    }

    function abrirCrear() {
      editIsNew.value = true
      editNota.value = null
      editClave.value = ''
      editValor.value = ''
      editPreviewMode.value = false
      editTicketType.value = filterMode.value === 'ticket' && props.ticketId ? 'especifica' : 'general'
      editError.value = ''
      showDocModal.value = true
      nextTick(() => {
        if (editClaveInput.value) editClaveInput.value.focus()
      })
    }

    async function verDetalle(n) {
      if (!proyectoId.value) return
      editIsNew.value = false
      editNota.value = n
      editClave.value = n.clave
      editPreviewMode.value = false
      editTicketType.value = n.id_ticket ? 'especifica' : 'general'
      editError.value = ''
      try {
        const full = await docNotasStore.getNota(proyectoId.value, n.clave)
        if (full) {
          editValor.value = full.valor || ''
          editNota.value = full
        } else {
          editValor.value = ''
        }
      } catch (err) {
        console.error('Error al cargar nota:', err)
        editValor.value = ''
      }
      showDocModal.value = true
      nextTick(() => {
        if (editClaveInput.value) editClaveInput.value.focus()
      })
    }

    async function guardarDocEdit() {
      const newClave = editClave.value.trim()
      if (!newClave || !editValor.value || !proyectoId.value) return
      editError.value = ''
      try {
        if (editIsNew.value) {
          const payload = {
            id_proyecto: proyectoId.value,
            clave: newClave,
            valor: editValor.value,
          }
          if (editTicketType.value === 'especifica' && props.ticketId) {
            payload.id_ticket = Number(props.ticketId)
          }
          await docNotasStore.createNota(payload)
          showDocModal.value = false
        } else {
          if (!editNota.value || !editNota.value.id) return
          await docNotasStore.updateNota(editNota.value.id, {
            clave: newClave,
            valor: editValor.value,
            id_ticket: editNota.value.id_ticket,
          }, proyectoId.value)
          editNota.value.clave = newClave
          editNota.value.valor = editValor.value
          showDocModal.value = false
        }
      } catch (err) {
        console.error('Error al guardar nota:', err)
        editError.value = err.message
      }
    }

    function closeDocModal() {
      showDocModal.value = false
      editNota.value = null
    }

    async function eliminarNota(n) {
      if (!confirm(`¿Eliminar la nota "${n.clave}"?`)) return
      if (!proyectoId.value) return
      try {
        await docNotasStore.deleteNota(n.id, proyectoId.value)
        if (selectedDoc.value?.id === n.id) {
          selectedDoc.value = null
        }
      } catch (err) {
        console.error('Error al eliminar nota:', err)
      }
    }

    function onLeftSplitStart(e) {
      const startY = e.clientY
      const container = e.target.closest('.descripcion-mejorar-modal > .d-flex')
      function onMouseMove(e) {
        if (!container) return
        const rect = container.getBoundingClientRect()
        const pct = ((e.clientY - rect.top) / rect.height) * 100
      }
      function onMouseUp() {
        document.removeEventListener('mousemove', onMouseMove)
        document.removeEventListener('mouseup', onMouseUp)
        document.body.style.cursor = ''
        document.body.style.userSelect = ''
      }
      document.addEventListener('mousemove', onMouseMove)
      document.addEventListener('mouseup', onMouseUp)
      document.body.style.cursor = 'row-resize'
      document.body.style.userSelect = 'none'
    }

    function onLeftPanelSplitStart(e) {
      const startX = e.clientX
      const startWidth = leftPanelWidth.value
      const container = e.target.closest('.descripcion-mejorar-modal')

      function onMouseMove(e) {
        const delta = e.clientX - startX
        const containerWidth = container ? container.getBoundingClientRect().width : 800
        const maxWidth = containerWidth - colMustacheWidth.value - colResultWidth.value - COL_MUSTACHE_MIN - COL_RESULT_MIN
        leftPanelWidth.value = Math.max(COL1_MIN + COL2_MIN + 6, Math.min(maxWidth, startWidth + delta))
      }

      function onMouseUp() {
        document.removeEventListener('mousemove', onMouseMove)
        document.removeEventListener('mouseup', onMouseUp)
        document.body.style.cursor = ''
        document.body.style.userSelect = ''
      }

      document.addEventListener('mousemove', onMouseMove)
      document.addEventListener('mouseup', onMouseUp)
      document.body.style.cursor = 'col-resize'
      document.body.style.userSelect = 'none'
    }

    async function iniciarOpencode() {
      if (!props.sessionId) return
      try {
        const res = await fetch(`/api/opencode/start?sessionId=${encodeURIComponent(props.sessionId)}`, { credentials: 'include' })
        if (!res.ok) return
        const data = await res.json()
        const provider = data.providers?.[0]
        if (!provider) return
        const model = provider.models?.[0]
        await fetch('/api/opencode/select', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          credentials: 'include',
          body: JSON.stringify({
            sessionId: props.sessionId,
            provider: provider.id,
            model: model?.id || model,
            thinking: 'medium',
            mode: 'Plan',
            temperature: '0.7',
          }),
        })
        ocStore.saveCurrentToMap(props.sessionId)
        chatStore.pushMessage({ role: 'opencode_info', content: 'OpenCode iniciado' })
      } catch (err) {
        console.error('Error al iniciar OpenCode:', err)
      }
    }

    async function sendToOc() {
      const text = ocInput.value.trim()
      if (!text || !props.sessionId || ocSending.value) return
      ocInput.value = ''
      ocSending.value = true

      const msgKey = 'oc-' + Date.now()
      chatStore.pushMessage({ role: 'opencode_confirmed', content: text, _key: msgKey })

      const map = ocStore.sessionsMap[String(props.sessionId)]
      if (!map) { ocSending.value = false; return }

      const streamKey = 'oc-stream-' + Date.now()
      chatStore.pushMessage({ role: 'opencode_stream', content: '', _key: streamKey, _streaming: true })

      try {
        await ocStore.streamPrompt(props.sessionId, text, map.selectedProvider, map.selectedModel,
          map.selectedThinking || 'medium', map.selectedMode || 'Plan', map.selectedTemperature || '0.7', {
          onChunk(content, full) {
            chatStore.updateMessageByKey(streamKey, { content: full, _streaming: true })
          },
          onThinking(content, full) {
            chatStore.updateMessageByKey(streamKey, { thinking: full })
          },
          onDone(json, fullText) {
            chatStore.updateMessageByKey(streamKey, { role: 'opencode_result', content: fullText, _streaming: false, thinking: json.thinking || '' })
          },
          onError(msg) {
            chatStore.updateMessageByKey(streamKey, { role: 'opencode_result', content: 'Error: ' + msg, _streaming: false })
          },
        })
      } catch (err) {
        console.error('Error en sendToOc:', err)
        chatStore.updateMessageByKey(streamKey, { role: 'opencode_result', content: 'Error: ' + err.message, _streaming: false })
      } finally {
        ocSending.value = false
        if (ocChatRef.value) nextTick(() => { ocChatRef.value.scrollTop = ocChatRef.value.scrollHeight })
      }
    }

    async function loadCol1Width() {
      try {
        const result = await settingGet(COL1_WIDTH_KEY)
        if (result.value) {
          col1Width.value = Math.max(COL1_MIN, parseInt(result.value, 10) || COL1_DEFAULT)
        }
      } catch (err) {
        console.error('Error al cargar ancho columna docs:', err)
      }
    }

    async function saveCol1Width() {
      try {
        await settingSet(COL1_WIDTH_KEY, String(col1Width.value))
      } catch (err) {
        console.error('Error al guardar ancho columna docs:', err)
      }
    }

    async function loadCol2Width() {
      try {
        const result = await settingGet(COL2_WIDTH_KEY)
        if (result.value) {
          col2Width.value = Math.max(COL2_MIN, parseInt(result.value, 10) || COL2_DEFAULT)
        }
      } catch (err) {
        console.error('Error al cargar ancho columna seleccionadas:', err)
      }
    }

    async function saveCol2Width() {
      try {
        await settingSet(COL2_WIDTH_KEY, String(col2Width.value))
      } catch (err) {
        console.error('Error al guardar ancho columna seleccionadas:', err)
      }
    }

    async function loadMustacheWidth() {
      try {
        const result = await settingGet(COL_MUSTACHE_WIDTH_KEY)
        if (result.value) {
          colMustacheWidth.value = Math.max(COL_MUSTACHE_MIN, parseInt(result.value, 10) || COL_MUSTACHE_DEFAULT)
        }
      } catch (err) {
        console.error('Error al cargar ancho columna mustache:', err)
      }
    }

    async function saveMustacheWidth() {
      try {
        await settingSet(COL_MUSTACHE_WIDTH_KEY, String(colMustacheWidth.value))
      } catch (err) {
        console.error('Error al guardar ancho columna mustache:', err)
      }
    }

    async function loadResultWidth() {
      try {
        const result = await settingGet(COL_RESULT_WIDTH_KEY)
        if (result.value) {
          colResultWidth.value = Math.max(COL_RESULT_MIN, parseInt(result.value, 10) || COL_RESULT_DEFAULT)
        }
      } catch (err) {
        console.error('Error al cargar ancho columna resultado:', err)
      }
    }

    async function saveResultWidth() {
      try {
        await settingSet(COL_RESULT_WIDTH_KEY, String(colResultWidth.value))
      } catch (err) {
        console.error('Error al guardar ancho columna resultado:', err)
      }
    }

    function onCol1SplitStart(e) {
      const startX = e.clientX
      const startWidth = col1Width.value
      const container = e.target.closest('.descripcion-mejorar-modal')

      function onMouseMove(e) {
        const delta = e.clientX - startX
        const containerWidth = container ? container.getBoundingClientRect().width : 600
        const minRemaining = COL2_MIN + COL_MUSTACHE_MIN + COL_RESULT_MIN
        const maxWidth = containerWidth - col2Width.value - colMustacheWidth.value - colResultWidth.value - minRemaining
        col1Width.value = Math.max(COL1_MIN, Math.min(maxWidth, startWidth + delta))
      }

      function onMouseUp() {
        document.removeEventListener('mousemove', onMouseMove)
        document.removeEventListener('mouseup', onMouseUp)
        document.body.style.cursor = ''
        document.body.style.userSelect = ''
        saveCol1Width()
      }

      document.addEventListener('mousemove', onMouseMove)
      document.addEventListener('mouseup', onMouseUp)
      document.body.style.cursor = 'col-resize'
      document.body.style.userSelect = 'none'
    }

    function onCol2SplitStart(e) {
      const startX = e.clientX
      const startWidth = col2Width.value
      const container = e.target.closest('.descripcion-mejorar-modal')

      function onMouseMove(e) {
        const delta = e.clientX - startX
        const containerWidth = container ? container.getBoundingClientRect().width : 600
        const minRemaining = COL1_MIN + COL_MUSTACHE_MIN + COL_RESULT_MIN
        const maxWidth = containerWidth - col1Width.value - colMustacheWidth.value - colResultWidth.value - minRemaining
        col2Width.value = Math.max(COL2_MIN, Math.min(maxWidth, startWidth + delta))
      }

      function onMouseUp() {
        document.removeEventListener('mousemove', onMouseMove)
        document.removeEventListener('mouseup', onMouseUp)
        document.body.style.cursor = ''
        document.body.style.userSelect = ''
        saveCol2Width()
      }

      document.addEventListener('mousemove', onMouseMove)
      document.addEventListener('mouseup', onMouseUp)
      document.body.style.cursor = 'col-resize'
      document.body.style.userSelect = 'none'
    }

    function onMustacheSplitStart(e) {
      const startX = e.clientX
      const startWidth = colMustacheWidth.value
      const container = e.target.closest('.descripcion-mejorar-modal')

      function onMouseMove(e) {
        const delta = e.clientX - startX
        const containerWidth = container ? container.getBoundingClientRect().width : 600
        const minRemaining = COL1_MIN + COL2_MIN + COL_RESULT_MIN
        const maxWidth = containerWidth - col1Width.value - col2Width.value - colResultWidth.value - minRemaining
        colMustacheWidth.value = Math.max(COL_MUSTACHE_MIN, Math.min(maxWidth, startWidth + delta))
      }

      function onMouseUp() {
        document.removeEventListener('mousemove', onMouseMove)
        document.removeEventListener('mouseup', onMouseUp)
        document.body.style.cursor = ''
        document.body.style.userSelect = ''
        saveMustacheWidth()
      }

      document.addEventListener('mousemove', onMouseMove)
      document.addEventListener('mouseup', onMouseUp)
      document.body.style.cursor = 'col-resize'
      document.body.style.userSelect = 'none'
    }

    function onResultSplitStart(e) {
      const startX = e.clientX
      const startWidth = colResultWidth.value
      const container = e.target.closest('.descripcion-mejorar-modal')

      function onMouseMove(e) {
        const delta = startX - e.clientX
        const containerWidth = container ? container.getBoundingClientRect().width : 600
        const minRemaining = COL1_MIN + COL2_MIN + COL_MUSTACHE_MIN
        const maxWidth = containerWidth - col1Width.value - col2Width.value - colMustacheWidth.value - minRemaining
        colResultWidth.value = Math.max(COL_RESULT_MIN, Math.min(maxWidth, startWidth + delta))
      }

      function onMouseUp() {
        document.removeEventListener('mousemove', onMouseMove)
        document.removeEventListener('mouseup', onMouseUp)
        document.body.style.cursor = ''
        document.body.style.userSelect = ''
        saveResultWidth()
      }

      document.addEventListener('mousemove', onMouseMove)
      document.addEventListener('mouseup', onMouseUp)
      document.body.style.cursor = 'col-resize'
      document.body.style.userSelect = 'none'
    }

    onMounted(async () => {
      await loadProyectoId()
      await Promise.all([
        loadCol1Width(),
        loadCol2Width(),
        loadMustacheWidth(),
        loadResultWidth(),
      ])
      leftPanelWidth.value = col1Width.value + col2Width.value + 6
      if (proyectoId.value) {
        await loadNotas()
        await loadProjectVars()
      }

      if (props.sessionId) {
        ocStore.loadFromMap(props.sessionId)
      }

      try {
        const res = await fetch('/api/settings/global', { credentials: 'include' })
        const keys = await res.json()
        promptAgentePrompt.value = keys.ticket_descripcion_mejorar_prompt || ''
        objetivoPrompt.value = keys.ticket_objetivo_prompt || ''
        plantillaDescripcion.value = keys.ticket_plantilla_descripcion || '## Objetivo\n{{objetivo}}\n## Notas Reunión\n{{notas_reunion}}\n## Promt Agente\n{{promt_opencode}}'
      } catch (err) {
        console.error('Error al cargar settings globales:', err)
      }
    })

    async function generar() {
      if (!notasReunion.value.trim()) return
      loading.value = true
      response.value = ''
      aiResponse.value = ''

      try {
        let objetivoFinal = objetivo.value.trim()
        if (!objetivoFinal) {
          response.value = 'Generando objetivo...'
          objetivoFinal = await streamRefine(
            `Notas de reunión:\n${notasReunion.value}`,
            objetivoPrompt.value,
            props.sessionId || undefined
          )
        }

        response.value = 'Generando prompt para agente OpenCode...'
        const docsText = selectedDocsResolvedText.value
        const promptData = docsText
          ? `Notas de reunión:\n${notasReunion.value}\n\nDatos adicionales:\n${textoAdicional.value || '(sin datos adicionales)'}\n\nDocumentaciones del proyecto:\n${docsText}`
          : `Notas de reunión:\n${notasReunion.value}\n\nDatos adicionales:\n${textoAdicional.value || '(sin datos adicionales)'}`
        const promtOpencode = await streamRefine(
          promptData,
          promptAgentePrompt.value,
          props.sessionId || undefined
        )

        let final = plantillaDescripcion.value
          .replace(/\{\{objetivo\}\}/g, objetivoFinal)
          .replace(/\{\{notas_reunion\}\}/g, notasReunion.value)
          .replace(/\{\{promt_opencode\}\}/g, promtOpencode)

        response.value = final
        aiResponse.value = final
      } catch (err) {
        console.error('Error al generar:', err)
        response.value = 'Error: ' + err.message
        aiResponse.value = ''
      } finally {
        loading.value = false
      }
    }

    function aplicar() {
      const finalText = aiResponse.value || response.value
      if (!finalText) return
      if (props.onApply) {
        props.onApply(finalText)
      }
      emit('close')
    }

    function cancelar() {
      emit('close')
    }

    function copiarTexto() {
      const textToCopy = aiResponse.value || response.value
      if (!textToCopy) return
      try {
        navigator.clipboard.writeText(textToCopy)
      } catch (err) {
        console.error('Error al copiar texto:', err)
      }
    }

    function aumentarFont() {
      if (fontSize.value < 24) fontSize.value += 2
      localStorage.setItem(FONT_SIZE_KEY, String(fontSize.value))
    }

    function disminuirFont() {
      if (fontSize.value > 10) fontSize.value -= 2
      localStorage.setItem(FONT_SIZE_KEY, String(fontSize.value))
    }

    return {
      COL1_MIN, COL2_MIN, COL_MUSTACHE_MIN, COL_RESULT_MIN,
      objetivo, notasReunion, textoAdicional, response, aiResponse, loading, viewMode, fontSize,
      generar, aplicar, cancelar, copiarTexto, aumentarFont, disminuirFont,
      col1Width, col2Width, colMustacheWidth, colResultWidth, leftPanelWidth, filterMode,
      onCol1SplitStart, onCol2SplitStart, onMustacheSplitStart, onResultSplitStart,
      onLeftSplitStart, onLeftPanelSplitStart,
      ocAgentLinked, ocMessages, ocInput, ocSending, ocChatRef, sendToOc, iniciarOpencode,
      filteredNotas, selectedNotas, loadingNotas, selectedDoc,
      toggleSelectDoc, isDocSelected,
      mustacheKeys, mustacheValues, showPreviewModal, previewViewMode, previewDocs, copiarPreview,
      showDocModal, editIsNew, editClave, editValor, editPreviewMode, editTicketType, editError, editIsJson, editParsedJson, editClaveInput,
      abrirCrear, verDetalle, guardarDocEdit, closeDocModal, eliminarNota,
    }
  },
}
</script>

<style scoped>
.btn-argentina {
  background-color: #75AADB;
  color: #fff;
  border: 1px solid #75AADB;
}
.btn-argentina:hover {
  background-color: #5a8fc0;
  color: #fff;
}
.btn-argentina:disabled {
  opacity: 0.6;
}
.btn-outline-argentina {
  background-color: transparent;
  color: #75AADB;
  border: 1px solid #75AADB;
}
.btn-outline-argentina:hover {
  background-color: #1a2744;
  color: #75AADB;
}
.blink {
  animation: blink 1s step-end infinite;
}
@keyframes blink {
  50% { opacity: 0; }
}

.desc-splitter {
  width: 6px;
  cursor: col-resize;
  flex-shrink: 0;
  background: transparent;
  transition: background 0.15s;
  position: relative;
  z-index: 5;
}
.desc-splitter:hover {
  background: rgba(117, 170, 219, 0.12);
}
.desc-row-splitter {
  height: 6px;
  cursor: row-resize;
  flex-shrink: 0;
  background: transparent;
  transition: background 0.15s;
  position: relative;
  z-index: 5;
}
.desc-row-splitter:hover {
  background: rgba(117, 170, 219, 0.12);
}
.doc-item {
  cursor: pointer;
  border-bottom: 1px solid #2d3748;
}
.doc-item:hover {
  background: #1e3050;
}
.doc-item.selected {
  background: #1e3050;
  border-left: 2px solid #75AADB;
}
.doc-clave {
  color: #75AADB;
}
.doc-item-delete-btn {
  display: none;
  background: none;
  border: none;
  color: #ef4444;
  cursor: pointer;
  font-size: 0.75rem;
  padding: 0 4px;
  line-height: 1.2;
  border-radius: 3px;
  flex-shrink: 0;
}
.doc-item:hover .doc-item-delete-btn {
  display: inline-block;
}
.doc-item-delete-btn:hover {
  background: rgba(239, 68, 68, 0.15);
}
.doc-edit-textarea {
  background: #0f172a;
  color: #cbd5e1;
  font-size: 0.75rem;
  font-family: monospace;
  line-height: 1.5;
  resize: none;
  outline: none;
}
.doc-edit-textarea::placeholder {
  color: #4b5563;
}
.desc-doc-modal-overlay {
  position: absolute;
  inset: 0;
  background: rgba(0, 0, 0, 0.55);
  z-index: 10;
  display: flex;
  align-items: center;
  justify-content: center;
}
</style>
