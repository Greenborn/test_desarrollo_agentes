<template>
  <div class="skills-tab d-flex flex-column h-100 overflow-hidden">
    <div v-if="!activeSession" class="d-flex flex-column align-items-center justify-content-center flex-grow-1 text-secondary small px-3 text-center">
      <span>Seleccione una sesión de chat</span>
    </div>
    <template v-else>
      <div class="skills-header d-flex align-items-center px-2 py-1 flex-shrink-0 gap-2" style="border-bottom: 1px solid #374151;">
        <span class="small text-light fw-semibold">Skills</span>
        <button class="btn btn-sm btn-outline-argentina ms-auto py-0 px-2" style="font-size: 0.65rem;" @click="crearSkill">+ Nuevo</button>
      </div>
      <div class="d-flex flex-grow-1 overflow-hidden" style="min-height: 0;">
        <div class="skills-list flex-shrink-0 overflow-y-auto" style="width: 120px; border-right: 1px solid #374151; background: #16213e;">
          <div v-if="loadingSkills" class="d-flex align-items-center justify-content-center text-secondary small py-4">
            <span class="spinner-border spinner-border-sm me-1" role="status"></span>
          </div>
          <div v-else-if="skills.length === 0" class="d-flex align-items-center justify-content-center text-secondary small px-2 py-4 text-center">
            <span>Sin skills</span>
          </div>
          <div v-for="s in skills" :key="s.name" class="skill-item d-flex align-items-center px-2 py-1 small"
            :class="{ selected: selectedSkill?.name === s.name }"
            @click="selectSkill(s)" role="button">
            <span class="text-truncate">{{ s.name }}</span>
          </div>
        </div>
        <div class="skills-editor-agent d-flex flex-grow-1 overflow-hidden">
          <div class="skills-editor d-flex flex-column overflow-hidden flex-grow-1" :style="{ minWidth: skillsEditorMinWidth + 'px' }">
            <div v-if="!selectedSkill" class="d-flex align-items-center justify-content-center flex-grow-1 text-secondary small px-3 text-center">
              <span>Seleccione un skill para editar</span>
            </div>
            <template v-else>
              <div class="editor-header d-flex align-items-center px-2 py-1 flex-shrink-0 gap-2" style="border-bottom: 1px solid #374151;">
                <span class="small text-muted text-truncate">{{ selectedSkill.name }}/SKILL.md</span>
                <span v-if="editorDirty" class="badge bg-warning text-dark" style="font-size: 0.55rem;">sin guardar</span>
                <label class="d-flex align-items-center gap-1 ms-auto small" style="font-size: 0.6rem; color: #9ca3af; cursor: pointer;" title="Alternar vista previa MD">
                  <input type="checkbox" v-model="formatMd" class="form-check-input m-0" style="width: 12px; height: 12px; cursor: pointer;" />
                  MD
                </label>
                <button class="btn btn-sm btn-outline-success py-0 px-2" style="font-size: 0.65rem;" @click="guardarSkill" :disabled="savingSkill">
                  {{ savingSkill ? 'Guardando...' : '💾 Guardar' }}
                </button>
              </div>
              <div class="d-flex flex-column flex-grow-1 overflow-hidden" style="min-height: 0;">
                <textarea class="skills-textarea w-100 border-0 p-2 small"
                  v-model="editorContent"
                  @input="editorDirty = true"
                  style="resize: none; background: #0f172a; color: #cbd5e1; font-family: monospace; font-size: 0.7rem;"
                  :style="{ flex: formatMd ? '0 0 50%' : '1 1 100%', minHeight: formatMd ? '80px' : '100px' }"
                  spellcheck="false"
                ></textarea>
                <div v-if="formatMd" class="skills-preview flex-grow-1 overflow-y-auto px-2 py-1" style="border-top: 1px solid #374151; background: #0f172a;">
                  <ChatFormatter :text="editorContent" />
                </div>
              </div>
            </template>
          </div>
          <div class="skills-agent-splitter" @mousedown.prevent="onAgentSplitStart"></div>
          <div class="skills-agent d-flex flex-column overflow-hidden" :style="{ width: agentWidth + 'px', minWidth: '120px' }">
            <div class="agent-header d-flex align-items-center px-2 py-1 flex-shrink-0 gap-1" style="border-bottom: 1px solid #374151;">
              <span class="small text-muted">Agente OpenCode</span>
              <div v-if="agentReady" class="ms-auto d-flex gap-1">
                <button class="btn btn-sm btn-outline-danger py-0 px-2" style="font-size: 0.6rem;" @click="detenerAgente" :disabled="!agentStreaming">⏹</button>
                <button class="btn btn-sm btn-outline-secondary py-0 px-2" style="font-size: 0.6rem;" @click="finalizarAgente">✕</button>
              </div>
              <button v-else class="btn btn-sm btn-outline-info ms-auto py-0 px-2" style="font-size: 0.6rem;" @click="iniciarAgente" :disabled="agentStarting">
                {{ agentStarting ? '...' : '▶ Iniciar' }}
              </button>
            </div>
            <div v-if="!agentReady" class="d-flex flex-column align-items-center justify-content-center flex-grow-1 text-secondary small px-2 text-center">
              <span>Inicie el agente OpenCode para mejorar skills</span>
            </div>
            <template v-else>
              <div class="agent-messages flex-grow-1 overflow-y-auto px-2 py-1" style="min-height: 0; background: #0f172a;">
                <div v-if="agentMessages.length === 0" class="d-flex align-items-center justify-content-center text-secondary small py-4">
                  <span>Escriba un mensaje para mejorar el skill</span>
                </div>
                <div v-for="(msg, i) in agentMessages" :key="i" class="agent-msg mb-1 px-1 py-1 rounded small" :class="'agent-msg-' + msg.role" style="font-size: 0.65rem; line-height: 1.3;">
                  <div class="text-muted" style="font-size: 0.55rem;">{{ msg.role === 'user' ? 'Tú' : 'Agente' }}</div>
                  <div class="text-light" v-html="renderMsg(msg.content)"></div>
                </div>
                <div v-if="agentStreaming" class="agent-msg agent-msg-assistant mb-1 px-1 py-1 rounded small" style="font-size: 0.65rem; line-height: 1.3;">
                  <div class="text-muted" style="font-size: 0.55rem;">Agente</div>
                  <div v-if="agentThinkingText" class="agent-thinking mb-1 px-1 py-1 rounded" style="background: #1a2744; border-left: 2px solid #6b7280; font-size: 0.6rem; color: #9ca3af;" @click="thinkingExpanded = !thinkingExpanded">
                    <div class="text-muted d-flex align-items-center gap-1" style="font-size: 0.55rem; cursor: pointer;">
                      <span>{{ thinkingExpanded ? '▾' : '▸' }}</span>
                      <span>Razonamiento</span>
                    </div>
                    <div v-if="thinkingExpanded" style="white-space: pre-wrap; word-break: break-word;">{{ agentThinkingText }}</div>
                  </div>
                  <div class="text-light" style="white-space: pre-wrap;">{{ agentStreamText }}</div>
                </div>
              </div>
              <div class="agent-input d-flex align-items-center px-2 py-1 flex-shrink-0 gap-1" style="border-top: 1px solid #374151;">
                <textarea class="agent-prompt flex-grow-1 border-0 p-1 small"
                  v-model="agentPrompt"
                  @keydown.enter.prevent="enviarAgente"
                  placeholder="Mejorar el skill..."
                  style="resize: none; background: #1a2744; color: #cbd5e1; font-family: monospace; font-size: 0.65rem; height: 28px; border-radius: 4px;"
                  :disabled="agentStreaming"
                ></textarea>
                <button class="btn btn-sm btn-outline-argentina py-0 px-2 flex-shrink-0" style="font-size: 0.6rem;" @click="enviarAgente" :disabled="agentStreaming || !agentPrompt.trim() || !selectedSkill">
                  ▶
                </button>
              </div>
            </template>
          </div>
        </div>
      </div>
    </template>
  </div>
</template>

<script>
import { ref, computed, watch, onMounted, onUnmounted } from 'vue'
import { storeToRefs } from 'pinia'
import { useChatStore } from '../../../stores/chat.js'
import { useModalStore } from '../../../stores/modal.js'
import { settingSet, settingGet } from '../../../services/settingService.js'
import ChatFormatter from '../../../components/chat/ChatFormatter.vue'
import AlertModal from '../../../components/modals/AlertModal.vue'

const SKILLS_AGENT_WIDTH_KEY = 'skills_agent_width'
const SKILLS_AGENT_MIN_WIDTH = 120
const SKILLS_EDITOR_MIN_WIDTH = 120

export default {
  components: { ChatFormatter, AlertModal },
  setup() {
    const chat = useChatStore()
    const modal = useModalStore()
    const { sessions, activeSessionId } = storeToRefs(chat)

    const activeSession = computed(() => {
      return sessions.value.find(s => s.id === activeSessionId.value) || null
    })

    const cwd = computed(() => activeSession.value?.cwd || null)

const skills = ref([])
const loadingSkills = ref(false)
const selectedSkill = ref(null)
const editorContent = ref('')
const editorDirty = ref(false)
const savingSkill = ref(false)

const formatMd = ref(true)
const agentWidth = ref(200)
const skillsEditorMinWidth = ref(SKILLS_EDITOR_MIN_WIDTH)

const agentReady = ref(false)
const agentStarting = ref(false)
const agentProvider = ref('')
const agentModel = ref('')
const agentThinking = ref('medium')
const agentMode = ref('Plan')
const agentTemperature = ref('0.7')
const agentOcSessionId = ref(null)
const agentMessages = ref([])
const agentPrompt = ref('')
const agentStreaming = ref(false)
const agentStreamText = ref('')
const agentAbortController = ref(null)
const agentThinkingText = ref('')
const thinkingExpanded = ref(false)

const SESSION_AGENT_STORAGE_KEY = 'skills_session_agent_states'
const sessionAgentStates = ref(loadSessionAgentStates())

function loadSessionAgentStates() {
  try {
    const raw = sessionStorage.getItem(SESSION_AGENT_STORAGE_KEY)
    return raw ? JSON.parse(raw) : {}
  } catch (e) {
    console.error('Error loading session agent states:', e)
    return {}
  }
}

function persistSessionAgentStates() {
  try {
    sessionStorage.setItem(SESSION_AGENT_STORAGE_KEY, JSON.stringify(sessionAgentStates.value))
  } catch (e) {
    console.error('Error persisting session agent states:', e)
  }
}

function saveAgentState(sessionId) {
  if (!sessionId) return
  sessionAgentStates.value[String(sessionId)] = {
    ready: agentReady.value,
    provider: agentProvider.value,
    model: agentModel.value,
    thinking: agentThinking.value,
    mode: agentMode.value,
    temperature: agentTemperature.value,
    messages: agentMessages.value.map(m => ({ ...m })),
    streaming: agentStreaming.value,
    streamText: agentStreamText.value,
    thinkingText: agentThinkingText.value,
    ocSessionId: agentOcSessionId.value,
    cwd: cwd.value,
  }
  persistSessionAgentStates()
}

function restoreAgentState(sessionId) {
  const state = sessionAgentStates.value[String(sessionId)]
  if (!state) return
  const sameCwd = state.cwd === cwd.value
  agentReady.value = sameCwd ? (state.ready || false) : false
  agentProvider.value = state.provider || ''
  agentModel.value = state.model || ''
  agentThinking.value = state.thinking || 'medium'
  agentMode.value = state.mode || 'Plan'
  agentTemperature.value = state.temperature || '0.7'
  agentMessages.value = state.messages || []
  agentStreaming.value = sameCwd ? (state.streaming || false) : false
  agentStreamText.value = state.streamText || ''
  agentThinkingText.value = state.thinkingText || ''
  agentOcSessionId.value = state.ocSessionId || null
}

function resetAgentState() {
  agentReady.value = false
  agentStarting.value = false
  agentProvider.value = ''
  agentModel.value = ''
  agentThinking.value = 'medium'
  agentMode.value = 'Plan'
  agentTemperature.value = '0.7'
  agentOcSessionId.value = null
  agentMessages.value = []
  agentPrompt.value = ''
  agentStreaming.value = false
  agentStreamText.value = ''
  agentAbortController.value = null
  agentThinkingText.value = ''
  thinkingExpanded.value = false
}

    async function loadAgentWidth() {
      try {
        const data = await settingGet(SKILLS_AGENT_WIDTH_KEY)
        if (data.value !== null) {
          agentWidth.value = Math.max(SKILLS_AGENT_MIN_WIDTH, parseInt(data.value, 10) || 200)
        }
      } catch (err) {
        console.error('Error al cargar ancho del agente:', err)
      }
    }

    async function saveAgentWidth() {
      try {
        await settingSet(SKILLS_AGENT_WIDTH_KEY, String(agentWidth.value))
      } catch (err) {
        console.error('Error al guardar ancho del agente:', err)
      }
    }

    function onAgentSplitStart(e) {
      const startX = e.clientX
      const startWidth = agentWidth.value
      const container = e.target.closest('.skills-editor-agent')
      const containerWidth = container ? container.getBoundingClientRect().width : 400

      function onMouseMove(e) {
        const delta = startX - e.clientX
        const maxWidth = containerWidth - SKILLS_EDITOR_MIN_WIDTH
        agentWidth.value = Math.max(SKILLS_AGENT_MIN_WIDTH, Math.min(maxWidth, startWidth + delta))
      }

      function onMouseUp() {
        document.removeEventListener('mousemove', onMouseMove)
        document.removeEventListener('mouseup', onMouseUp)
        document.body.style.cursor = ''
        document.body.style.userSelect = ''
        saveAgentWidth()
      }

      document.addEventListener('mousemove', onMouseMove)
      document.addEventListener('mouseup', onMouseUp)
      document.body.style.cursor = 'col-resize'
      document.body.style.userSelect = 'none'
    }

    async function cargarSkills() {
      if (!cwd.value) {
        skills.value = []
        return
      }
      loadingSkills.value = true
      try {
        const res = await fetch(`/api/skills/list?cwd=${encodeURIComponent(cwd.value)}`, {
          credentials: 'include',
        })
        const data = await res.json()
        skills.value = data.skills || []
      } catch (err) {
        console.error('Error al cargar skills:', err)
        skills.value = []
      } finally {
        loadingSkills.value = false
      }
    }

    async function selectSkill(skill) {
      if (editorDirty.value) {
        if (!confirm(`Hay cambios sin guardar en "${selectedSkill.value?.name}". ¿Descartar cambios?`)) return
      }
      selectedSkill.value = skill
      editorDirty.value = false
      editorContent.value = ''
      try {
        const res = await fetch(`/api/command/read-file?path=${encodeURIComponent(skill.path)}`, {
          credentials: 'include',
        })
        const data = await res.json()
        if (data.success) {
          editorContent.value = data.content
        }
      } catch (err) {
        console.error('Error al leer skill:', err)
        editorContent.value = 'Error al leer el archivo'
      }
    }

    async function guardarSkill() {
      if (!selectedSkill.value) return
      savingSkill.value = true
      try {
        const res = await fetch('/api/command/write-file', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          credentials: 'include',
          body: JSON.stringify({
            path: selectedSkill.value.path,
            content: editorContent.value,
          }),
        })
        const data = await res.json()
        if (data.success) {
          editorDirty.value = false
        }
      } catch (err) {
        console.error('Error al guardar skill:', err)
      } finally {
        savingSkill.value = false
      }
    }

    async function crearSkill() {
      if (!cwd.value) return
      const name = prompt('Nombre del nuevo skill:')
      if (!name || !name.trim()) return
      try {
        const res = await fetch('/api/skills/create', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          credentials: 'include',
          body: JSON.stringify({ name: name.trim(), cwd: cwd.value }),
        })
        const data = await res.json()
        if (data.success) {
          await cargarSkills()
          const nuevo = skills.value.find(s => s.name === name.trim())
          if (nuevo) selectSkill(nuevo)
        } else {
          modal.open(AlertModal, { message: data.error || 'Error al crear skill' }, { title: 'Error' })
        }
      } catch (err) {
        console.error('Error al crear skill:', err)
        modal.open(AlertModal, { message: 'Error al crear skill' }, { title: 'Error' })
      }
    }

    async function iniciarAgente() {
      if (!cwd.value || agentStarting.value) return
      agentStarting.value = true
      try {
        const res = await fetch('/api/opencode/editor-start', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          credentials: 'include',
          body: JSON.stringify({ cwd: cwd.value }),
        })
        const data = await res.json()
        if (data.error) {
          console.error('Error al iniciar agente:', data.error)
          return
        }
        if (data.providers && data.providers.length > 0) {
          const prov = data.providers[0]
          agentProvider.value = prov.id
          const models = prov.models ? Object.keys(prov.models) : []
          if (models.length > 0) {
            agentModel.value = models[0]
          }
          if (data.defaultModels && data.defaultModels[prov.id]) {
            agentModel.value = data.defaultModels[prov.id]
          }
        }
        agentReady.value = true
        agentMessages.value = []
        agentStreamText.value = ''
      } catch (err) {
        console.error('Error al iniciar agente:', err)
      } finally {
        agentStarting.value = false
      }
    }

    async function enviarAgente() {
      const text = agentPrompt.value.trim()
      if (!text || !selectedSkill.value || agentStreaming.value) return
      agentPrompt.value = ''

      if (editorDirty.value) {
        await guardarSkill()
      }

      const contextPrompt = `Trabajo en el directorio raíz del proyecto: "${cwd.value}"

Estoy editando el skill "${selectedSkill.value.name}" ubicado en la ruta relativa:
.agents/skills/${selectedSkill.value.name}/SKILL.md
(ruta absoluta: ${selectedSkill.value.path})

Contenido actual del archivo SKILL.md:
\`\`\`markdown
${editorContent.value}
\`\`\`

${text}`

      agentMessages.value.push({ role: 'user', content: text })
      agentStreaming.value = true
      agentStreamText.value = ''
      agentThinkingText.value = ''
      thinkingExpanded.value = false

      const abortController = new AbortController()
      agentAbortController.value = abortController

      try {
        const res = await fetch('/api/opencode/editor-send', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          credentials: 'include',
          body: JSON.stringify({
            prompt: contextPrompt,
            provider: agentProvider.value,
            model: agentModel.value,
            thinking: agentThinking.value,
            mode: agentMode.value,
            temperature: agentTemperature.value,
            cwd: cwd.value,
          }),
          signal: abortController.signal,
        })

        if (!res.ok) {
          const errData = await res.json()
          throw new Error(errData.error || 'Error al enviar')
        }

        const reader = res.body.getReader()
        const decoder = new TextDecoder()
        let buf = ''
        let fullResponse = ''

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
                fullResponse += j.content
                agentStreamText.value = fullResponse
              } else if (j.type === 'thinking') {
                agentThinkingText.value += j.content
              } else if (j.type === 'done') {
                agentMessages.value.push({ role: 'assistant', content: fullResponse })
                agentStreamText.value = ''
                refrescarSkill()
              } else if (j.type === 'error') {
                agentMessages.value.push({ role: 'assistant', content: '[Error: ' + j.content + ']' })
              }
            } catch (e) {
              console.error('Error parsing SSE:', e)
            }
          }
        }

        if (fullResponse && !agentMessages.value.some(m => m.role === 'assistant' && m.content === fullResponse)) {
          agentMessages.value.push({ role: 'assistant', content: fullResponse })
          agentStreamText.value = ''
          refrescarSkill()
        }
      } catch (err) {
        if (err.name !== 'AbortError') {
          console.error('Error en agente:', err)
          agentMessages.value.push({ role: 'assistant', content: '[Error: ' + err.message + ']' })
        }
      } finally {
        agentStreaming.value = false
        agentAbortController.value = null
      }
    }

    function detenerAgente() {
      if (agentAbortController.value) {
        agentAbortController.value.abort()
      }
      fetch('/api/opencode/editor-abort', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ ocSessionId: agentOcSessionId.value, cwd: cwd.value }),
      }).catch(err => console.error('Error al abortar agente:', err))
    }

    async function finalizarAgente(skipCleanup = false) {
      if (agentStreaming.value) {
        detenerAgente()
      }
      try {
        await fetch('/api/opencode/editor-finish', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          credentials: 'include',
          body: JSON.stringify({ cwd: cwd.value }),
        })
      } catch (err) {
        console.error('Error al finalizar agente:', err)
      }
      if (activeSessionId.value && !skipCleanup) {
        delete sessionAgentStates.value[String(activeSessionId.value)]
        persistSessionAgentStates()
      }
      resetAgentState()
    }

    async function refrescarSkill() {
      if (!selectedSkill.value) return
      try {
        const res = await fetch(`/api/command/read-file?path=${encodeURIComponent(selectedSkill.value.path)}`, {
          credentials: 'include',
        })
        const data = await res.json()
        if (data.success) {
          editorContent.value = data.content
          editorDirty.value = false
        }
      } catch (err) {
        console.error('Error al refrescar skill:', err)
      }
    }

    watch(cwd, (newCwd, oldCwd) => {
      if (oldCwd && newCwd !== oldCwd) {
        if (activeSessionId.value) {
          saveAgentState(activeSessionId.value)
          const sId = String(activeSessionId.value)
          if (sessionAgentStates.value[sId]) {
            sessionAgentStates.value[sId].ready = false
            sessionAgentStates.value[sId].streaming = false
          }
          persistSessionAgentStates()
        }
        if (agentReady.value || agentStreaming.value) {
          if (agentStreaming.value) {
            detenerAgente()
          }
          finalizarAgente(true)
        }
      }
      selectedSkill.value = null
      editorContent.value = ''
      editorDirty.value = false
      skills.value = []
      cargarSkills()
    })

    watch(activeSessionId, (newId, oldId) => {
      if (oldId && String(oldId) !== String(newId)) {
        if (agentStreaming.value) {
          detenerAgente()
        }
        saveAgentState(oldId)
        resetAgentState()
      }
      if (newId) {
        restoreAgentState(newId)
      }
    })

    onMounted(() => {
      loadAgentWidth()
      cargarSkills()
    })

    onUnmounted(() => {
      if (activeSessionId.value) {
        saveAgentState(activeSessionId.value)
      }
      if (agentReady.value) {
        finalizarAgente()
      }
    })

    function renderMsg(text) {
      if (!text) return ''
      return text
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/\n/g, '<br>')
        .replace(/```(\w*)\n?([\s\S]*?)```/g, '<pre style="background:#1a2744;padding:4px;border-radius:3px;font-size:0.6rem;margin:4px 0;overflow-x:auto;"><code>$2</code></pre>')
        .replace(/`([^`]+)`/g, '<code style="background:#1a2744;padding:1px 3px;border-radius:2px;font-size:0.6rem;">$1</code>')
        .replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>')
    }

    return {
      activeSession,
      skills, loadingSkills, selectedSkill,
      editorContent, editorDirty, savingSkill, formatMd,
      agentWidth, skillsEditorMinWidth,
      agentReady, agentStarting, agentMessages, agentPrompt,
      agentStreaming, agentStreamText, agentThinkingText, thinkingExpanded,
      selectSkill, guardarSkill, crearSkill,
      iniciarAgente, enviarAgente, detenerAgente, finalizarAgente,
      onAgentSplitStart, renderMsg,
    }
  },
}
</script>

<style scoped>
.skills-tab {
  background: #1a1a2e;
}
.skills-list {
  background: #16213e;
}
.skill-item {
  cursor: pointer;
  color: #cbd5e1;
  border-left: 2px solid transparent;
  transition: background 0.15s;
}
.skill-item:hover {
  background: #1e3050;
}
.skill-item.selected {
  background: #1e3050;
  border-left-color: #75AADB;
  color: #75AADB;
}
.skills-editor {
  background: #0f172a;
}
.skills-agent {
  background: #16213e;
  border-left: 1px solid #374151;
}
.skills-agent-splitter {
  width: 6px;
  cursor: col-resize;
  flex-shrink: 0;
  background: transparent;
  transition: background 0.15s;
  position: relative;
  z-index: 5;
}
.skills-agent-splitter:hover {
  background: rgba(117, 170, 219, 0.12);
}
.agent-msg {
  word-break: break-word;
}
.agent-msg-user {
  background: #1a2744;
  border: 1px solid #374151;
}
.agent-msg-assistant {
  background: #1e3050;
  border: 1px solid #374151;
}
.skills-textarea:focus {
  outline: none;
  box-shadow: none;
}
.skills-preview {
  min-height: 60px;
}
.skills-preview :deep(h1),
.skills-preview :deep(h2),
.skills-preview :deep(h3),
.skills-preview :deep(h4) {
  color: #e2e8f0;
  margin-top: 0.5rem;
  margin-bottom: 0.25rem;
}
.skills-preview :deep(p) {
  margin-bottom: 0.25rem;
}
.skills-preview :deep(code) {
  background: #1a2744;
  padding: 1px 3px;
  border-radius: 2px;
  font-size: 0.65rem;
}
.skills-preview :deep(pre) {
  background: #1a2744;
  padding: 4px;
  border-radius: 3px;
  font-size: 0.6rem;
  overflow-x: auto;
}
</style>
