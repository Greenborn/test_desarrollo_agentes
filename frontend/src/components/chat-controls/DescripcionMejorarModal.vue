<template>
  <div class="descripcion-mejorar-modal d-flex flex-column gap-3" style="height: 100%;">
    <div class="d-flex gap-3 flex-grow-1" style="min-height: 0;">
      <div class="d-flex flex-column gap-2" style="flex: 1 1 50%; min-width: 0; min-height: 0;">
        <label class="form-label small mb-0" style="color: #9ca3af;">Objetivo</label>
        <textarea
          v-model="objetivo"
          class="form-control bg-dark text-light border-secondary font-monospace"
          rows="2"
          style="resize: vertical;"
          placeholder="Opcional. Si se deja vacío se genera automáticamente desde las notas de reunión"
        ></textarea>

        <label class="form-label small mb-0 mt-2" style="color: #9ca3af;">Notas de reunión</label>
        <textarea
          v-model="notasReunion"
          class="form-control bg-dark text-light border-secondary font-monospace flex-grow-1"
          rows="5"
          style="resize: vertical; min-height: 100px;"
        ></textarea>

        <label class="form-label small mb-0 mt-2" style="color: #9ca3af;">Texto adicional (opcional)</label>
        <textarea
          v-model="textoAdicional"
          class="form-control bg-dark text-light border-secondary font-monospace"
          rows="2"
          style="resize: vertical;"
          placeholder="Datos adicionales para el prompt del agente"
        ></textarea>

        <button
          class="btn btn-sm btn-argentina mt-1 align-self-start"
          @click="generar"
          :disabled="loading || !notasReunion.trim()"
        >
          <span v-if="loading" class="spinner-border spinner-border-sm me-1" role="status"></span>
          {{ loading ? 'Generando...' : '↻ Generar' }}
        </button>
      </div>

      <div class="d-flex flex-column gap-2" style="flex: 1 1 50%; min-width: 0; min-height: 0;">
        <div class="d-flex justify-content-between align-items-center">
          <label class="form-label small mb-0" style="color: #9ca3af;">
            Respuesta
            <span v-if="aiResponse" class="text-success ms-1">({{ aiResponse.length }} caracteres)</span>
          </label>
          <div v-if="response" class="d-flex gap-1">
            <button
              class="btn btn-sm"
              :class="viewMode === 'rendered' ? 'btn-argentina' : 'btn-outline-secondary'"
              @click="viewMode = 'rendered'"
              style="font-size: 0.7rem; line-height: 1; padding: 2px 6px;"
            >
              Vista previa
            </button>
            <button
              class="btn btn-sm"
              :class="viewMode === 'raw' ? 'btn-argentina' : 'btn-outline-secondary'"
              @click="viewMode = 'raw'"
              style="font-size: 0.7rem; line-height: 1; padding: 2px 6px;"
            >
              Texto plano
            </button>
            <button
              class="btn btn-sm btn-outline-secondary"
              @click="copiarTexto"
              title="Copiar texto plano"
              style="font-size: 0.7rem; line-height: 1; padding: 2px 6px;"
            >
              📋
            </button>
            <span class="text-secondary mx-1" style="opacity: 0.3;">|</span>
            <button
              class="btn btn-sm btn-outline-secondary"
              @click="disminuirFont"
              title="Reducir tamaño de letra"
              style="font-size: 0.7rem; line-height: 1; padding: 2px 6px;"
            >
              A⁻
            </button>
            <span style="font-size: 0.7rem; color: #9ca3af; min-width: 22px; text-align: center;">{{ fontSize }}</span>
            <button
              class="btn btn-sm btn-outline-secondary"
              @click="aumentarFont"
              title="Aumentar tamaño de letra"
              style="font-size: 0.7rem; line-height: 1; padding: 2px 6px;"
            >
              A⁺
            </button>
          </div>
        </div>
        <div
          class="flex-grow-1 border border-secondary rounded"
          style="overflow-y: auto; overflow-x: hidden; min-height: 0; background: #1a1d21; word-break: break-word; overflow-wrap: break-word; max-width: 100%;"
        >
          <div v-if="!response && loading" class="p-2" style="min-height: 120px; color: #6c757d;">Esperando respuesta...</div>
          <div v-else-if="!response && !loading" class="p-2" style="min-height: 120px;"></div>
          <div v-else-if="viewMode === 'rendered'" class="p-2" :style="{ fontSize: fontSize + 'px', minHeight: '120px' }">
            <ChatFormatter :text="response" />
          </div>
          <pre v-else class="m-0 p-2" :style="{ fontSize: fontSize + 'px', whiteSpace: 'pre-wrap', wordBreak: 'break-word', overflowWrap: 'break-word', overflow: 'hidden', maxWidth: '100%', minHeight: '120px', color: '#e0e0e0', background: 'transparent', border: 'none' }">{{ response }}</pre>
        </div>
        <span v-if="loading && !response" class="blink" style="color: #75AADB;">▌</span>
      </div>
    </div>

    <div class="d-flex gap-2 justify-content-end pt-2 border-top border-secondary">
      <button
        class="btn btn-sm btn-argentina"
        @click="aplicar"
        :disabled="!aiResponse || loading"
      >
        ✓ Aplicar cambios
      </button>
      <button class="btn btn-sm btn-outline-argentina" @click="cancelar">
        Cancelar
      </button>
    </div>
  </div>
</template>

<script>
import { ref, onMounted } from 'vue'
import ChatFormatter from '../chat/ChatFormatter.vue'

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

const FONT_SIZE_KEY = 'descripcion_modal_font_size'

export default {
  components: { ChatFormatter },
  props: {
    sessionId: { type: [String, Number], default: '' },
    onApply: { type: Function, default: null },
  },
  emits: ['close'],
  setup(props, { emit }) {
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

    onMounted(async () => {
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
        const promtOpencode = await streamRefine(
          `Notas de reunión:\n${notasReunion.value}\n\nDatos adicionales:\n${textoAdicional.value || '(sin datos adicionales)'}`,
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

    return { objetivo, notasReunion, textoAdicional, response, loading, viewMode, fontSize, generar, aplicar, cancelar, copiarTexto, aumentarFont, disminuirFont }
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
</style>
