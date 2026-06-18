<template>
  <div class="h-100 d-flex flex-column text-light gap-3">
    <div class="flex-shrink-0">
      <div class="d-flex gap-2 align-items-center flex-wrap">
        <input
          type="text"
          class="form-control bg-dark text-light border-secondary"
          style="min-width: 120px; flex: 3 1 180px;"
          placeholder="Buscar configuración..."
          v-model="searchTerm"
        />
        <select
          class="form-select bg-dark text-light border-secondary"
          style="width: auto; min-width: 140px; flex: 0 1 auto;"
          v-model="selectedWId"
          @change="onWorkspaceChange"
        >
          <option v-for="w in workspaces" :key="w.id" :value="w.id">{{ w.name }}</option>
        </select>
        <button class="btn btn-sm btn-outline-argentina flex-shrink-0" @click="promptCreate">+ Nuevo</button>
        <button class="btn btn-sm btn-outline-argentina flex-shrink-0" @click="promptRename" v-if="selectedWId !== 1">Editar</button>
        <button class="btn btn-sm btn-outline-danger flex-shrink-0" @click="confirmDelete" v-if="selectedWId !== 1">Eliminar</button>
      </div>
    </div>

    <div class="row g-4 flex-grow-1 overflow-auto" style="min-height: 0;">
      <div class="col-md-6 d-flex flex-column gap-4">
        <div v-if="matches('api key deepseek')">
          <label class="form-label">API Key DeepSeek</label>
          <div class="input-group">
            <input
              :type="showKey ? 'text' : 'password'"
              class="form-control bg-dark text-light border-secondary"
              v-model="keyInput"
              placeholder="sk-..."
            />
            <button class="btn btn-outline-argentina" @click="showKey = !showKey">
              {{ showKey ? 'Ocultar' : 'Mostrar' }}
            </button>
          </div>
          <button class="btn btn-sm mt-2 btn-argentina" @click="saveKey">
            Guardar Key
          </button>
        </div>

        <div v-if="matches('token redmine')">
          <label class="form-label">Token Redmine</label>
          <div class="input-group">
            <input
              :type="showRedmineToken ? 'text' : 'password'"
              class="form-control bg-dark text-light border-secondary"
              v-model="redmineTokenInput"
              placeholder="token..."
            />
            <button class="btn btn-outline-argentina" @click="showRedmineToken = !showRedmineToken">
              {{ showRedmineToken ? 'Ocultar' : 'Mostrar' }}
            </button>
          </div>
          <button class="btn btn-sm mt-2 btn-argentina" @click="saveRedmineToken">
            Guardar Token
          </button>
        </div>

        <div v-if="matches('url redmine')">
          <label class="form-label">URL Redmine</label>
          <input
            type="text"
            class="form-control bg-dark text-light border-secondary"
            v-model="redmineUrlInput"
            placeholder="https://redmine.tudominio.com"
          />
          <button class="btn btn-sm mt-2 btn-argentina" @click="saveRedmineUrl">
            Guardar URL
          </button>
        </div>

        <div v-if="matches('system prompt del agente')">
          <label class="form-label">System Prompt del agente</label>
          <textarea
            class="form-control font-monospace bg-dark text-light border-secondary"
            rows="8"
            v-model="promptInput"
          ></textarea>
          <button class="btn btn-sm mt-2 btn-argentina" @click="savePrompt">
            Guardar Prompt
          </button>
        </div>

        <div v-if="matches('debounce omnifiltro')">
          <label class="form-label">Omnifiltro — Tiempo de debounce (ms)</label>
          <input
            type="number"
            class="form-control bg-dark text-light border-secondary"
            v-model.number="omnifilterDebounceInput"
            min="0"
            step="100"
            placeholder="2000"
          />
          <button class="btn btn-sm mt-2 btn-argentina" @click="saveOmnifilterDebounce">
            Guardar
          </button>
        </div>

        <div v-if="matches('acronimo rama repositorio git')">
          <label class="form-label">Acrónimo para ramas Git</label>
          <input
            type="text"
            class="form-control bg-dark text-light border-secondary"
            v-model="repoAcronimoInput"
            placeholder="TKT"
          />
          <button class="btn btn-sm mt-2 btn-argentina" @click="saveRepoAcronimo">
            Guardar
          </button>
        </div>
      </div>

      <div class="col-md-6 d-flex flex-column gap-4">
        <div v-if="matches('base de datos')">
          <label class="form-label">Prompt Documentación - Base de Datos</label>
          <textarea
            class="form-control font-monospace bg-dark text-light border-secondary"
            rows="4"
            v-model="docBdInput"
          ></textarea>
          <button class="btn btn-sm mt-2 btn-argentina" @click="saveDoc('base_datos')">
            Guardar Prompt
          </button>
        </div>

        <div v-if="matches('subproyectos')">
          <label class="form-label">Prompt Documentación - Subproyectos</label>
          <textarea
            class="form-control font-monospace bg-dark text-light border-secondary"
            rows="4"
            v-model="docSubInput"
          ></textarea>
          <button class="btn btn-sm mt-2 btn-argentina" @click="saveDoc('subproyectos')">
            Guardar Prompt
          </button>
        </div>

        <div v-if="matches('endpoints')">
          <label class="form-label">Prompt Documentación - Endpoints</label>
          <textarea
            class="form-control font-monospace bg-dark text-light border-secondary"
            rows="4"
            v-model="docEndpointsInput"
          ></textarea>
          <button class="btn btn-sm mt-2 btn-argentina" @click="saveDoc('endpoints')">
            Guardar Prompt
          </button>
        </div>

        <div v-if="matches('websockets')">
          <label class="form-label">Prompt Documentación - WebSockets</label>
          <textarea
            class="form-control font-monospace bg-dark text-light border-secondary"
            rows="4"
            v-model="docWsInput"
          ></textarea>
          <button class="btn btn-sm mt-2 btn-argentina" @click="saveDoc('web_sockets')">
            Guardar Prompt
          </button>
        </div>

        <div v-if="matches('funcionalidades')">
          <label class="form-label">Prompt Documentación - Funcionalidades</label>
          <textarea
            class="form-control font-monospace bg-dark text-light border-secondary"
            rows="4"
            v-model="docFuncInput"
          ></textarea>
          <button class="btn btn-sm mt-2 btn-argentina" @click="saveDoc('funcionalidades')">
            Guardar Prompt
          </button>
        </div>

        <div v-if="matches('descripcion ticket prompt redactar')">
          <label class="form-label">Prompt de Sistema — Redactar Descripción Ticket</label>
          <textarea
            class="form-control font-monospace bg-dark text-light border-secondary"
            rows="4"
            v-model="descripcionPromptInput"
          ></textarea>
          <button class="btn btn-sm mt-2 btn-argentina" @click="saveDescripcionPrompt">
            Guardar Prompt
          </button>
        </div>

        <div v-if="matches('refinar descripcion ticket prompt')">
          <label class="form-label">Prompt de Sistema — Refinar Descripción Ticket (DeepSeek)</label>
          <textarea
            class="form-control font-monospace bg-dark text-light border-secondary"
            rows="4"
            v-model="refinarPromptInput"
          ></textarea>
          <button class="btn btn-sm mt-2 btn-argentina" @click="saveRefinarPrompt">
            Guardar Prompt
          </button>
        </div>
      </div>
    </div>

    <div class="flex-shrink-0">
      <div v-if="settings.saveSuccess" class="alert alert-success py-2 small mb-0">{{ settings.saveSuccess }}</div>
      <div v-if="settings.saveError" class="alert alert-danger py-2 small mb-0">{{ settings.saveError }}</div>
      <div v-if="wsMessage" class="alert alert-info py-2 small mb-0">{{ wsMessage }}</div>
    </div>
  </div>
</template>

<script>
import { ref, onMounted, watch } from 'vue'
import { storeToRefs } from 'pinia'
import { useSettingsStore } from '../stores/settings.js'
import { useWorkspaceStore } from '../stores/workspace.js'
import { useChatStore } from '../stores/chat.js'
import { useAuthStore } from '../stores/auth.js'
import { useModalStore } from '../stores/modal.js'

export default {
  setup() {
    const settings = useSettingsStore()
    const wsStore = useWorkspaceStore()
    const chatStore = useChatStore()
    const auth = useAuthStore()
    const modal = useModalStore()
    const { workspaces } = storeToRefs(wsStore)

    const keyInput = ref('')
    const redmineTokenInput = ref('')
    const redmineUrlInput = ref('')
    const promptInput = ref('')
    const docBdInput = ref('')
    const docSubInput = ref('')
    const docEndpointsInput = ref('')
    const docWsInput = ref('')
    const docFuncInput = ref('')
    const showKey = ref(false)
    const showRedmineToken = ref(false)
    const searchTerm = ref('')
    const descripcionPromptInput = ref('')
    const refinarPromptInput = ref('')
    const omnifilterDebounceInput = ref(2000)
    const repoAcronimoInput = ref('TKT')
    const selectedWId = ref(1)
    const wsMessage = ref('')

    function matches(label) {
      if (!searchTerm.value) return true
      return label.toLowerCase().includes(searchTerm.value.toLowerCase())
    }

    const DOC_INPUTS = {
      base_datos: docBdInput,
      subproyectos: docSubInput,
      endpoints: docEndpointsInput,
      web_sockets: docWsInput,
      funcionalidades: docFuncInput,
    }

    const DOC_STORE_MAP = {
      base_datos: 'documentacionPromptBaseDatos',
      subproyectos: 'documentacionPromptSubproyectos',
      endpoints: 'documentacionPromptEndpoints',
      web_sockets: 'documentacionPromptWebSockets',
      funcionalidades: 'documentacionPromptFuncionalidades',
    }

    onMounted(async () => {
      await wsStore.loadWorkspaces()
      selectedWId.value = auth.getWorkspaceId()
      if (!selectedWId.value || !workspaces.value.find(w => w.id === selectedWId.value)) {
        selectedWId.value = 1
      }
      await settings.load()
    })

    watch(() => settings.systemPrompt, (val) => {
      promptInput.value = val
    }, { immediate: true })

    watch(() => settings.deepseekKey, (val) => {
      keyInput.value = val
    }, { immediate: true })

    watch(() => settings.redmineToken, (val) => {
      redmineTokenInput.value = val
    }, { immediate: true })

    watch(() => settings.redmineUrl, (val) => {
      redmineUrlInput.value = val
    }, { immediate: true })

    watch(() => settings.omnifilterDebounceMs, (val) => {
      omnifilterDebounceInput.value = val
    }, { immediate: true })

    watch(() => settings.repoAcronimo, (val) => {
      repoAcronimoInput.value = val
    }, { immediate: true })

    watch(() => settings.ticketDescripcionPrompt, (val) => {
      descripcionPromptInput.value = val
    }, { immediate: true })

    watch(() => settings.ticketRefinarPrompt, (val) => {
      refinarPromptInput.value = val
    }, { immediate: true })

    for (const [key, refName] of Object.entries(DOC_STORE_MAP)) {
      watch(() => settings[refName], (val) => {
        DOC_INPUTS[key].value = val
      }, { immediate: true })
    }

    async function reloadSettings() {
      settings.clearFeedback()
      await settings.load()
    }

    async function onWorkspaceChange() {
      const newId = selectedWId.value
      const oldId = auth.getWorkspaceId()
      if (newId === oldId) return

      const hasProcesses = chatStore.executing || chatStore.streaming
      if (hasProcesses) {
        const confirmed = confirm('Se detendrán todos los procesos en ejecución. ¿Desea cambiar de espacio de trabajo?')
        if (!confirmed) {
          selectedWId.value = oldId
          return
        }
      }

      wsMessage.value = 'Deteniendo procesos y cambiando espacio de trabajo...'
      const result = await wsStore.selectWorkspace(newId)
      if (result.success) {
        auth.user = { ...auth.user, workspaceId: newId }
        chatStore.stopAllExecutions()
        await wsStore.loadWorkspaces()
        await reloadSettings()
        wsMessage.value = 'Espacio de trabajo cambiado correctamente.'
        setTimeout(() => { wsMessage.value = '' }, 3000)
      } else {
        wsMessage.value = 'Error al cambiar de espacio de trabajo.'
        selectedWId.value = oldId
      }
    }

    async function promptCreate() {
      const name = prompt('Nombre del nuevo espacio de trabajo:')
      if (!name || !name.trim()) return
      wsMessage.value = 'Creando espacio de trabajo...'
      const result = await wsStore.createWorkspace(name.trim())
      if (result.success) {
        wsMessage.value = 'Espacio de trabajo creado.'
        wsStore.loadWorkspaces()
        setTimeout(() => { wsMessage.value = '' }, 3000)
      } else {
        wsMessage.value = result.error || 'Error al crear espacio de trabajo.'
      }
    }

    async function promptRename() {
      const ws = workspaces.value.find(w => w.id === selectedWId.value)
      if (!ws) return
      const name = prompt('Nuevo nombre:', ws.name)
      if (!name || !name.trim() || name.trim() === ws.name) return
      const result = await wsStore.updateWorkspace(ws.id, name.trim())
      if (result.success) {
        wsMessage.value = 'Espacio de trabajo renombrado.'
        setTimeout(() => { wsMessage.value = '' }, 3000)
      } else {
        wsMessage.value = result.error || 'Error al renombrar.'
      }
    }

    async function confirmDelete() {
      const ws = workspaces.value.find(w => w.id === selectedWId.value)
      if (!ws) return
      const confirmed = confirm(`¿Está seguro de eliminar el espacio de trabajo "${ws.name}"?\n\nSe eliminarán todas las sesiones de chat, proyectos y tickets asociados.`)
      if (!confirmed) return
      wsMessage.value = 'Eliminando espacio de trabajo...'
      const result = await wsStore.deleteWorkspace(ws.id)
      if (result.success) {
        workspaces.value = workspaces.value.filter(w => w.id !== ws.id)
        selectedWId.value = 1
        auth.user = { ...auth.user, workspaceId: 1 }
        await wsStore.selectWorkspace(1)
        chatStore.stopAllExecutions()
        await wsStore.loadWorkspaces()
        await reloadSettings()
        wsMessage.value = 'Espacio de trabajo eliminado. Cambiado a "Por Defecto".'
        setTimeout(() => { wsMessage.value = '' }, 3000)
      } else {
        wsMessage.value = result.error || 'Error al eliminar.'
      }
    }

    function saveKey() {
      settings.clearFeedback()
      settings.save('deepseek_key', keyInput.value)
    }

    function saveRedmineToken() {
      settings.clearFeedback()
      settings.save('redmine_token', redmineTokenInput.value)
    }

    function saveRedmineUrl() {
      settings.clearFeedback()
      settings.save('redmine_url', redmineUrlInput.value)
    }

    function savePrompt() {
      settings.clearFeedback()
      settings.save('system_prompt', promptInput.value)
    }

    function saveDoc(tipo) {
      settings.clearFeedback()
      settings.save('documentacion_prompt_' + tipo, DOC_INPUTS[tipo].value)
    }

    function saveOmnifilterDebounce() {
      settings.clearFeedback()
      settings.save('omnifilter_debounce_ms', String(omnifilterDebounceInput.value))
    }

    function saveDescripcionPrompt() {
      settings.clearFeedback()
      settings.save('ticket_descripcion_prompt', descripcionPromptInput.value)
    }

    function saveRepoAcronimo() {
      settings.clearFeedback()
      settings.save('repo_acronimo', repoAcronimoInput.value)
    }

    function saveRefinarPrompt() {
      settings.clearFeedback()
      settings.save('ticket_refinar_prompt', refinarPromptInput.value)
    }

    return {
      keyInput, redmineTokenInput, redmineUrlInput, promptInput, docBdInput, docSubInput,
      docEndpointsInput, docWsInput, docFuncInput, descripcionPromptInput, refinarPromptInput,
      showKey, showRedmineToken, searchTerm, omnifilterDebounceInput, repoAcronimoInput,
      settings, workspaces, selectedWId, wsMessage,
      saveKey, saveRedmineToken, saveRedmineUrl, savePrompt, saveDoc,
      saveOmnifilterDebounce, saveDescripcionPrompt, saveRefinarPrompt, saveRepoAcronimo, matches,
      onWorkspaceChange, promptCreate, promptRename, confirmDelete,
    }
  },
}
</script>

<style>
.btn-argentina {
  background-color: #75AADB;
  color: #fff;
  border: 1px solid #75AADB;
}
.btn-argentina:hover {
  background-color: #5a8fc0;
  color: #fff;
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
</style>
