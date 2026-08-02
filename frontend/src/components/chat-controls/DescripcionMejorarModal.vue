<template>
  <div class="descripcion-mejorar-modal d-flex flex-column" style="height: 100%; min-height: 0;">
    <div class="d-flex flex-grow-1" style="min-height: 0;">
      <!-- LEFT PANEL: OpenCode chat -->
      <div class="d-flex flex-column flex-shrink-0" :style="{ width: leftPanelWidth + 'px', minWidth: '200px' }">
        <div class="d-flex flex-column flex-grow-1" style="min-height: 0;">
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
  </div>
</template>

<script>
import { ref, computed, onMounted, nextTick } from 'vue'
import { useChatStore } from '../../stores/chat.js'
import { useOpencodeStore } from '../../stores/opencode.js'
import { settingGet, settingSet } from '../../services/settingService.js'
import ChatFormatter from '../chat/ChatFormatter.vue'

const LEFT_PANEL_WIDTH_KEY = 'desc_mejorar_left_panel_width'
const LEFT_PANEL_MIN = 200
const LEFT_PANEL_DEFAULT = 260
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
    try { const errData = await res.json(); if (errData.error) errMsg = errData.error } catch (parseErr) { console.log('[DescripcionMejorar] Error al parsear body de error:', parseErr.message); }
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
  components: { ChatFormatter },
  props: {
    sessionId: { type: [String, Number], default: '' },
    ticketId: { type: [String, Number], default: null },
    onApply: { type: Function, default: null },
  },
  emits: ['close'],
  setup(props, { emit }) {
    const chatStore = useChatStore()

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

    const colResultWidth = ref(COL_RESULT_DEFAULT)

    // OpenCode chat
    const ocStore = useOpencodeStore()
    const leftPanelWidth = ref(LEFT_PANEL_DEFAULT)
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

    function onLeftPanelSplitStart(e) {
      const startX = e.clientX
      const startWidth = leftPanelWidth.value
      const container = e.target.closest('.descripcion-mejorar-modal')

      function onMouseMove(e) {
        const delta = e.clientX - startX
        const containerWidth = container ? container.getBoundingClientRect().width : 800
        const maxWidth = containerWidth - colResultWidth.value - COL_RESULT_MIN
        leftPanelWidth.value = Math.max(LEFT_PANEL_MIN, Math.min(maxWidth, startWidth + delta))
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
        chatStore.pushMessage({ role: 'opencode_info', content: 'OpenCode iniciado', _key: 'oc-info-' + Date.now() })
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

    async function loadLeftPanelWidth() {
      try {
        const result = await settingGet(LEFT_PANEL_WIDTH_KEY)
        if (result.value) {
          leftPanelWidth.value = Math.max(LEFT_PANEL_MIN, parseInt(result.value, 10) || LEFT_PANEL_DEFAULT)
        }
      } catch (err) {
        console.error('Error al cargar ancho panel izquierdo:', err)
      }
    }

    async function saveLeftPanelWidth() {
      try {
        await settingSet(LEFT_PANEL_WIDTH_KEY, String(leftPanelWidth.value))
      } catch (err) {
        console.error('Error al guardar ancho panel izquierdo:', err)
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

    function onResultSplitStart(e) {
      const startX = e.clientX
      const startWidth = colResultWidth.value
      const container = e.target.closest('.descripcion-mejorar-modal')

      function onMouseMove(e) {
        const delta = startX - e.clientX
        const containerWidth = container ? container.getBoundingClientRect().width : 600
        const minRemaining = LEFT_PANEL_MIN
        const maxWidth = containerWidth - leftPanelWidth.value - minRemaining
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
      await Promise.all([
        loadLeftPanelWidth(),
        loadResultWidth(),
      ])

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
        const promptData = `Notas de reunión:\n${notasReunion.value}\n\nDatos adicionales:\n${textoAdicional.value || '(sin datos adicionales)'}`
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
      objetivo, notasReunion, textoAdicional, response, aiResponse, loading, viewMode, fontSize,
      generar, aplicar, cancelar, copiarTexto, aumentarFont, disminuirFont,
      colResultWidth, leftPanelWidth,
      onResultSplitStart, onLeftPanelSplitStart,
      ocAgentLinked, ocMessages, ocInput, ocSending, ocChatRef, sendToOc, iniciarOpencode,
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
</style>
