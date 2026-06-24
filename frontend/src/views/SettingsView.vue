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
        <button class="btn btn-sm btn-outline-argentina flex-shrink-0 ms-auto" @click="exportAllConfig">Exportar</button>
        <button class="btn btn-sm btn-outline-argentina flex-shrink-0" @click="triggerImport">Importar</button>
        <input type="file" ref="importInput" accept=".json" @change="handleImport" style="display:none" />
        <button class="btn btn-sm btn-outline-info flex-shrink-0" @click="exportFullState">Exportar Estado DB</button>
        <button class="btn btn-sm btn-outline-info flex-shrink-0" @click="triggerImportState">Importar Estado DB</button>
        <input type="file" ref="importStateInput" accept=".json" @change="handleImportState" style="display:none" />
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

        <div v-if="matches('locale idioma')">
          <label class="form-label">Locale (idioma del agente OpenCode)</label>
          <input
            type="text"
            class="form-control bg-dark text-light border-secondary"
            v-model="localeInput"
            placeholder="es_ES.UTF-8"
          />
          <button class="btn btn-sm mt-2 btn-argentina" @click="saveLocale">
            Guardar
          </button>
        </div>

        <div v-if="matches('colores prioridad')" class="border-top border-secondary pt-3">
          <label class="form-label mb-2 fw-bold">Colores de Prioridad</label>
          <div class="d-flex align-items-center gap-2 mb-2">
            <span class="small text-nowrap" style="width: 90px;">Baja</span>
            <input type="color" class="form-control form-control-color bg-dark border-secondary p-1" style="width: 50px; height: 32px;" v-model="priorityColorLowInput" />
            <input type="text" class="form-control bg-dark text-light border-secondary font-monospace small" style="width: 100px;" v-model="priorityColorLowInput" placeholder="#hex" />
            <button class="btn btn-sm btn-argentina" @click="savePriorityColor('priority_color_low')">Guardar</button>
          </div>
          <div class="d-flex align-items-center gap-2 mb-2">
            <span class="small text-nowrap" style="width: 90px;">Normal</span>
            <input type="color" class="form-control form-control-color bg-dark border-secondary p-1" style="width: 50px; height: 32px;" v-model="priorityColorNormalInput" />
            <input type="text" class="form-control bg-dark text-light border-secondary font-monospace small" style="width: 100px;" v-model="priorityColorNormalInput" placeholder="#hex" />
            <button class="btn btn-sm btn-argentina" @click="savePriorityColor('priority_color_normal')">Guardar</button>
          </div>
          <div class="d-flex align-items-center gap-2 mb-2">
            <span class="small text-nowrap" style="width: 90px;">Alta</span>
            <input type="color" class="form-control form-control-color bg-dark border-secondary p-1" style="width: 50px; height: 32px;" v-model="priorityColorHighInput" />
            <input type="text" class="form-control bg-dark text-light border-secondary font-monospace small" style="width: 100px;" v-model="priorityColorHighInput" placeholder="#hex" />
            <button class="btn btn-sm btn-argentina" @click="savePriorityColor('priority_color_high')">Guardar</button>
          </div>
          <div class="d-flex align-items-center gap-2 mb-2">
            <span class="small text-nowrap" style="width: 90px;">Urgente</span>
            <input type="color" class="form-control form-control-color bg-dark border-secondary p-1" style="width: 50px; height: 32px;" v-model="priorityColorUrgentInput" />
            <input type="text" class="form-control bg-dark text-light border-secondary font-monospace small" style="width: 100px;" v-model="priorityColorUrgentInput" placeholder="#hex" />
            <button class="btn btn-sm btn-argentina" @click="savePriorityColor('priority_color_urgent')">Guardar</button>
          </div>
          <div class="d-flex align-items-center gap-2 mb-2">
            <span class="small text-nowrap" style="width: 90px;">Inmediata</span>
            <input type="color" class="form-control form-control-color bg-dark border-secondary p-1" style="width: 50px; height: 32px;" v-model="priorityColorImmediateInput" />
            <input type="text" class="form-control bg-dark text-light border-secondary font-monospace small" style="width: 100px;" v-model="priorityColorImmediateInput" placeholder="#hex" />
            <button class="btn btn-sm btn-argentina" @click="savePriorityColor('priority_color_immediate')">Guardar</button>
          </div>
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

        <div v-if="matches('deteccion funcionalidades prompt deteccion_funcionalidades')">
          <label class="form-label">Prompt — Detección de Funcionalidades (OpenCode)</label>
          <textarea
            class="form-control font-monospace bg-dark text-light border-secondary"
            rows="4"
            v-model="deteccionPromptInput"
          ></textarea>
          <button class="btn btn-sm mt-2 btn-argentina" @click="saveDeteccionPrompt">
            Guardar Prompt
          </button>
        </div>

        <div v-if="matches('codigo extensiones archivos code_file')" class="border-top border-secondary pt-3">
          <label class="form-label mb-2 fw-bold">Archivos de Código</label>
          <div class="small text-muted mb-2">Extensiones de archivos considerados código (separadas por coma) y tamaño máximo en KB para incluir en el árbol.</div>
          <div class="d-flex gap-2 mb-2 align-items-start">
            <div style="flex: 1;">
              <label class="form-label small">Extensiones</label>
              <input type="text" class="form-control form-control-sm bg-dark text-light border-secondary font-monospace" v-model="codeExtensionsInput" placeholder=".js,.vue,.py,..." />
            </div>
            <div style="width: 120px;">
              <label class="form-label small">Max KB</label>
              <input type="number" class="form-control form-control-sm bg-dark text-light border-secondary font-monospace" v-model.number="codeMaxSizeInput" min="1" />
            </div>
            <div class="pt-4">
              <button class="btn btn-sm btn-argentina" @click="saveCodeConfig">Guardar</button>
            </div>
          </div>
        </div>

        <div v-if="matches('intervalo reproduccion navegador')" class="border-top border-secondary pt-3">
          <label class="form-label">Intervalo de Reproducción del Navegador (ms)</label>
          <div class="small text-muted mb-2">Tiempo entre cada acción al reproducir grabaciones en Eventos del Navegador</div>
          <input
            type="number"
            class="form-control bg-dark text-light border-secondary"
            v-model.number="replayIntervalInput"
            min="100"
            step="100"
            placeholder="1000"
            style="max-width: 200px;"
          />
          <button class="btn btn-sm mt-2 btn-argentina" @click="saveReplayInterval">Guardar</button>
        </div>

        <div v-if="matches('resoluciones pantalla resolucion')" class="border-top border-secondary pt-3">
          <label class="form-label mb-2 fw-bold">Resoluciones de Pantalla</label>
          <div class="small text-muted mb-2">Usadas por /navegador_iniciar --resolution=ID</div>
          <div v-for="(res, i) in resolutionsEdit" :key="i" class="d-flex gap-2 mb-1 align-items-center">
            <input type="text" class="form-control form-control-sm bg-dark text-light border-secondary font-monospace" style="width: 130px;" placeholder="id" v-model="resolutionsEdit[i].id" />
            <input type="number" class="form-control form-control-sm bg-dark text-light border-secondary font-monospace" style="width: 90px;" placeholder="ancho" v-model.number="resolutionsEdit[i].width" min="1" />
            <span class="text-muted small">x</span>
            <input type="number" class="form-control form-control-sm bg-dark text-light border-secondary font-monospace" style="width: 90px;" placeholder="alto" v-model.number="resolutionsEdit[i].height" min="1" />
            <button class="btn btn-sm btn-outline-danger" @click="removeResolution(i)" title="Eliminar">✕</button>
          </div>
          <div class="d-flex gap-2 mb-2 align-items-center">
            <input type="text" class="form-control form-control-sm bg-dark text-light border-secondary font-monospace" style="width: 130px;" placeholder="nuevo id" v-model="newResId" />
            <input type="number" class="form-control form-control-sm bg-dark text-light border-secondary font-monospace" style="width: 90px;" placeholder="ancho" v-model.number="newResWidth" min="1" />
            <span class="text-muted small">x</span>
            <input type="number" class="form-control form-control-sm bg-dark text-light border-secondary font-monospace" style="width: 90px;" placeholder="alto" v-model.number="newResHeight" min="1" />
            <button class="btn btn-sm btn-outline-argentina" @click="addResolution">+ Agregar</button>
            <button class="btn btn-sm btn-outline-secondary" @click="resetResolutions" title="Restaurar valores por defecto">↺</button>
          </div>
          <button class="btn btn-sm btn-argentina" @click="saveResolutions">Guardar Resoluciones</button>
        </div>

        <div v-if="matches('ambientes entorno dev tst prd')" class="border-top border-secondary pt-3">
          <label class="form-label mb-2 fw-bold">Ambientes</label>
          <div class="small text-muted mb-2">Ambientes de trabajo con rama y descripción</div>
          <div v-for="(env, i) in environmentsList" :key="env.id || i" class="d-flex gap-2 mb-1 align-items-center">
            <input type="text" class="form-control form-control-sm bg-dark text-light border-secondary font-monospace" style="width: 80px;" placeholder="nombre" v-model="environmentsList[i].name" />
            <input type="text" class="form-control form-control-sm bg-dark text-light border-secondary font-monospace" style="width: 100px;" placeholder="rama" v-model="environmentsList[i].branch" />
            <input type="text" class="form-control form-control-sm bg-dark text-light border-secondary" style="flex: 1;" placeholder="descripción" v-model="environmentsList[i].description" />
            <button class="btn btn-sm btn-outline-argentina" @click="saveEnvironment(i)" title="Guardar">✓</button>
            <button class="btn btn-sm btn-outline-danger" @click="deleteEnvironment(i)" title="Eliminar" v-if="environmentsList[i].id">✕</button>
          </div>
          <div class="d-flex gap-2 mt-2 align-items-center">
            <input type="text" class="form-control form-control-sm bg-dark text-light border-secondary font-monospace" style="width: 80px;" placeholder="nombre" v-model="newEnvName" />
            <input type="text" class="form-control form-control-sm bg-dark text-light border-secondary font-monospace" style="width: 100px;" placeholder="rama" v-model="newEnvBranch" />
            <input type="text" class="form-control form-control-sm bg-dark text-light border-secondary" style="flex: 1;" placeholder="descripción" v-model="newEnvDescription" />
            <button class="btn btn-sm btn-outline-argentina" @click="addEnvironment">+ Agregar</button>
          </div>
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
    const deteccionPromptInput = ref('')
    const codeExtensionsInput = ref('.js,.jsx,.ts,.tsx,.vue,.py,.php,.java,.rb,.go,.rs,.c,.cpp,.h,.hpp,.cs,.swift,.kt,.scala,.sh,.bash,.pl,.lua,.r,.m,.mm,.css,.scss,.less,.sass,.html,.sql')
    const codeMaxSizeInput = ref(100)
    const omnifilterDebounceInput = ref(2000)
    const repoAcronimoInput = ref('TKT')
    const localeInput = ref('es_ES.UTF-8')
    const priorityColorLowInput = ref('#6b7280')
    const priorityColorNormalInput = ref('#3b82f6')
    const priorityColorHighInput = ref('#eab308')
    const priorityColorUrgentInput = ref('#ef4444')
    const priorityColorImmediateInput = ref('#ef4444')
    const resolutionsEdit = ref([])
    const newResId = ref('')
    const newResWidth = ref(1920)
    const newResHeight = ref(1080)
    const environmentsList = ref([])
    const replayIntervalInput = ref(1000)
    const newEnvName = ref('')
    const newEnvBranch = ref('')
    const newEnvDescription = ref('')
    const selectedWId = ref(1)
    const wsMessage = ref('')
    const importInput = ref(null)

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
      await loadEnvironments()
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

    watch(() => settings.locale, (val) => {
      localeInput.value = val
    }, { immediate: true })

    watch(() => settings.priorityColorLow, (val) => { priorityColorLowInput.value = val }, { immediate: true })
    watch(() => settings.priorityColorNormal, (val) => { priorityColorNormalInput.value = val }, { immediate: true })
    watch(() => settings.priorityColorHigh, (val) => { priorityColorHighInput.value = val }, { immediate: true })
    watch(() => settings.priorityColorUrgent, (val) => { priorityColorUrgentInput.value = val }, { immediate: true })
    watch(() => settings.priorityColorImmediate, (val) => { priorityColorImmediateInput.value = val }, { immediate: true })

    watch(() => settings.screenResolutions, (val) => {
      resolutionsEdit.value = val.map(r => ({ ...r }))
    }, { immediate: true, deep: true })

    watch(() => settings.replayIntervalMs, (val) => {
      replayIntervalInput.value = val
    }, { immediate: true })

    watch(() => settings.ticketDescripcionPrompt, (val) => {
      descripcionPromptInput.value = val
    }, { immediate: true })

    watch(() => settings.ticketRefinarPrompt, (val) => {
      refinarPromptInput.value = val
    }, { immediate: true })

    watch(() => settings.deteccionFuncionalidadesPrompt, (val) => {
      deteccionPromptInput.value = val
    }, { immediate: true })

    watch(() => settings.codeFileExtensions, (val) => {
      codeExtensionsInput.value = val
    }, { immediate: true })

    watch(() => settings.codeFileMaxSizeKb, (val) => {
      codeMaxSizeInput.value = val
    }, { immediate: true })

    for (const [key, refName] of Object.entries(DOC_STORE_MAP)) {
      watch(() => settings[refName], (val) => {
        DOC_INPUTS[key].value = val
      }, { immediate: true })
    }

    async function reloadSettings() {
      settings.clearFeedback()
      await settings.load()
      await loadEnvironments()
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
        auth.setWorkspaceId(newId)
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
        auth.setWorkspaceId(1)
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

    function saveDeteccionPrompt() {
      settings.clearFeedback()
      settings.save('deteccion_funcionalidades_prompt', deteccionPromptInput.value)
    }

    function saveCodeConfig() {
      settings.clearFeedback()
      settings.save('code_file_extensions', codeExtensionsInput.value)
      settings.save('code_file_max_size_kb', String(codeMaxSizeInput.value))
    }

    function saveLocale() {
      settings.clearFeedback()
      settings.save('locale', localeInput.value)
    }

    function saveReplayInterval() {
      settings.clearFeedback()
      settings.save('replay_interval_ms', String(replayIntervalInput.value))
    }

    function savePriorityColor(key) {
      settings.clearFeedback()
      const inputMap = {
        priority_color_low: priorityColorLowInput,
        priority_color_normal: priorityColorNormalInput,
        priority_color_high: priorityColorHighInput,
        priority_color_urgent: priorityColorUrgentInput,
        priority_color_immediate: priorityColorImmediateInput,
      }
      settings.save(key, inputMap[key].value)
    }

    function addResolution() {
      const id = newResId.value.trim()
      if (!id) return
      if (resolutionsEdit.value.find(r => r.id === id)) return
      resolutionsEdit.value.push({ id, width: newResWidth.value, height: newResHeight.value })
      newResId.value = ''
      newResWidth.value = 1920
      newResHeight.value = 1080
    }

    function removeResolution(index) {
      resolutionsEdit.value.splice(index, 1)
    }

    function resetResolutions() {
      resolutionsEdit.value = [
        { id: 'fullhd', width: 1920, height: 1080 },
        { id: 'hd', width: 1366, height: 768 },
        { id: 'hd_plus', width: 1600, height: 900 },
        { id: 'qhd', width: 2560, height: 1440 },
        { id: '4k', width: 3840, height: 2160 },
        { id: 'macbook_air', width: 2560, height: 1664 },
        { id: 'macbook_pro', width: 3024, height: 1964 },
        { id: 'iphone_14', width: 390, height: 844 },
        { id: 'iphone_14_pro_max', width: 430, height: 932 },
        { id: 'iphone_se', width: 375, height: 667 },
        { id: 'pixel_7', width: 412, height: 915 },
        { id: 'samsung_s23', width: 360, height: 780 },
        { id: 'ipad_air', width: 820, height: 1180 },
        { id: 'ipad_mini', width: 744, height: 1133 },
      ]
    }

    function saveResolutions() {
      const valid = resolutionsEdit.value.filter(r => r.id && r.id.trim() && r.width > 0 && r.height > 0)
      if (valid.length === 0) return
      settings.save('screen_resolutions', JSON.stringify(valid))
    }

    async function loadEnvironments() {
      try {
        const res = await fetch('/api/environments', { credentials: 'include' })
        const data = await res.json()
        environmentsList.value = data.environments || []
      } catch (err) {
        console.error('Error al cargar ambientes:', err.message)
      }
    }

    async function saveEnvironment(index) {
      const env = environmentsList.value[index]
      if (!env.name || !env.branch) {
        wsMessage.value = 'Nombre y rama son requeridos'
        setTimeout(() => { wsMessage.value = '' }, 3000)
        return
      }
      try {
        const res = await fetch(`/api/environments/${env.id}`, {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          credentials: 'include',
          body: JSON.stringify({ name: env.name, branch: env.branch, description: env.description }),
        })
        const data = await res.json()
        if (data.success) {
          wsMessage.value = 'Ambiente actualizado.'
        } else {
          wsMessage.value = data.error || 'Error al actualizar ambiente'
        }
      } catch (err) {
        console.error('Error al guardar ambiente:', err.message)
        wsMessage.value = 'Error al guardar ambiente'
      }
      setTimeout(() => { wsMessage.value = '' }, 3000)
    }

    async function addEnvironment() {
      if (!newEnvName.value.trim() || !newEnvBranch.value.trim()) {
        wsMessage.value = 'Nombre y rama son requeridos'
        setTimeout(() => { wsMessage.value = '' }, 3000)
        return
      }
      try {
        const res = await fetch('/api/environments', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          credentials: 'include',
          body: JSON.stringify({
            name: newEnvName.value.trim(),
            branch: newEnvBranch.value.trim(),
            description: newEnvDescription.value.trim() || null,
          }),
        })
        const data = await res.json()
        if (data.success) {
          environmentsList.value.push(data.environment)
          newEnvName.value = ''
          newEnvBranch.value = ''
          newEnvDescription.value = ''
          wsMessage.value = 'Ambiente creado.'
        } else {
          wsMessage.value = data.error || 'Error al crear ambiente'
        }
      } catch (err) {
        console.error('Error al crear ambiente:', err.message)
        wsMessage.value = 'Error al crear ambiente'
      }
      setTimeout(() => { wsMessage.value = '' }, 3000)
    }

    async function deleteEnvironment(index) {
      const env = environmentsList.value[index]
      if (!env.id) return
      const confirmed = confirm(`¿Eliminar ambiente "${env.name}"?`)
      if (!confirmed) return
      try {
        const res = await fetch(`/api/environments/${env.id}`, {
          method: 'DELETE',
          credentials: 'include',
        })
        const data = await res.json()
        if (data.success) {
          environmentsList.value.splice(index, 1)
          wsMessage.value = 'Ambiente eliminado.'
        } else {
          wsMessage.value = data.error || 'Error al eliminar ambiente'
        }
      } catch (err) {
        console.error('Error al eliminar ambiente:', err.message)
        wsMessage.value = 'Error al eliminar ambiente'
      }
      setTimeout(() => { wsMessage.value = '' }, 3000)
    }

    function triggerImport() {
      importInput.value?.click()
    }

    async function exportAllConfig() {
      try {
        const res = await fetch('/api/settings/export-all', { credentials: 'include' })
        const data = await res.json()
        const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' })
        const url = URL.createObjectURL(blob)
        const a = document.createElement('a')
        a.href = url
        a.download = `configuracion_${new Date().toISOString().split('T')[0]}.json`
        a.click()
        URL.revokeObjectURL(url)
      } catch (err) {
        console.error('Error al exportar configuración:', err.message)
        wsMessage.value = 'Error al exportar configuración'
        setTimeout(() => { wsMessage.value = '' }, 3000)
      }
    }

    async function handleImport(event) {
      const file = event.target.files[0]
      if (!file) return
      try {
        const text = await file.text()
        const data = JSON.parse(text)
        const res = await fetch('/api/settings/import-all', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          credentials: 'include',
          body: JSON.stringify(data),
        })
        const result = await res.json()
        if (result.success) {
          wsMessage.value = 'Configuración importada correctamente.'
          await reloadSettings()
        } else {
          wsMessage.value = result.error || 'Error al importar configuración'
        }
      } catch (err) {
        console.error('Error al importar configuración:', err.message)
        wsMessage.value = 'Error al importar configuración'
      }
      setTimeout(() => { wsMessage.value = '' }, 3000)
      event.target.value = ''
    }

    const importStateInput = ref(null)

    function triggerImportState() {
      importStateInput.value?.click()
    }

    async function exportFullState() {
      try {
        const res = await fetch('/api/state/export', { credentials: 'include' })
        const data = await res.json()
        const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' })
        const url = URL.createObjectURL(blob)
        const a = document.createElement('a')
        a.href = url
        a.download = `estado_db_${new Date().toISOString().split('T')[0]}.json`
        a.click()
        URL.revokeObjectURL(url)
      } catch (err) {
        console.error('Error al exportar estado DB:', err.message)
        wsMessage.value = 'Error al exportar estado DB'
        setTimeout(() => { wsMessage.value = '' }, 3000)
      }
    }

    async function handleImportState(event) {
      const file = event.target.files[0]
      if (!file) return
      try {
        const text = await file.text()
        const data = JSON.parse(text)
        const res = await fetch('/api/state/import', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          credentials: 'include',
          body: JSON.stringify(data),
        })
        const result = await res.json()
        if (result.success) {
          wsMessage.value = 'Estado DB importado correctamente.'
          await reloadSettings()
        } else {
          wsMessage.value = result.error || 'Error al importar estado DB'
        }
      } catch (err) {
        console.error('Error al importar estado DB:', err.message)
        wsMessage.value = 'Error al importar estado DB'
      }
      setTimeout(() => { wsMessage.value = '' }, 3000)
      event.target.value = ''
    }

    return {
      keyInput, redmineTokenInput, redmineUrlInput, promptInput, docBdInput, docSubInput,
      docEndpointsInput, docWsInput, docFuncInput, descripcionPromptInput, refinarPromptInput,
      deteccionPromptInput,
      codeExtensionsInput, codeMaxSizeInput,
      showKey, showRedmineToken, searchTerm, omnifilterDebounceInput, repoAcronimoInput,
      localeInput,
      priorityColorLowInput, priorityColorNormalInput, priorityColorHighInput,
      priorityColorUrgentInput, priorityColorImmediateInput,
      settings, workspaces, selectedWId, wsMessage,
      resolutionsEdit, newResId, newResWidth, newResHeight,
      environmentsList, newEnvName, newEnvBranch, newEnvDescription,
      replayIntervalInput,
      saveKey, saveRedmineToken, saveRedmineUrl, savePrompt, saveDoc,
      saveOmnifilterDebounce, saveDescripcionPrompt, saveRefinarPrompt, saveDeteccionPrompt, saveCodeConfig, saveRepoAcronimo,
      saveLocale, savePriorityColor, saveReplayInterval,
      addResolution, removeResolution, resetResolutions, saveResolutions, matches,
      saveEnvironment, addEnvironment, deleteEnvironment,
      onWorkspaceChange, promptCreate, promptRename, confirmDelete,
      exportAllConfig, handleImport, triggerImport, importInput,
      exportFullState, handleImportState, triggerImportState, importStateInput,
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
