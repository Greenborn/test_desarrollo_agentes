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
        <button class="btn btn-sm btn-outline-argentina flex-shrink-0" @click="openCreateModal">+ Nuevo</button>
        <button class="btn btn-sm btn-outline-argentina flex-shrink-0" @click="openEditModal">Editar</button>
        <button class="btn btn-sm btn-outline-danger flex-shrink-0" @click="openDeleteConfirm" v-if="selectedWId !== 1">Eliminar</button>
        <div v-if="deleteConfirmWs" class="d-flex align-items-center gap-2 ms-1">
          <span class="small text-danger">¿Eliminar "{{ deleteConfirmWs.name }}"?</span>
          <button class="btn btn-sm btn-outline-danger" @click="executeDelete" :disabled="deleting">Sí, eliminar</button>
          <button class="btn btn-sm btn-outline-secondary" @click="cancelDelete">Cancelar</button>
        </div>
        <button class="btn btn-sm btn-outline-argentina flex-shrink-0 ms-auto" @click="exportAllConfig">Exportar</button>
        <button class="btn btn-sm btn-outline-argentina flex-shrink-0" @click="triggerImport">Importar</button>
        <input type="file" ref="importInput" accept=".json" @change="handleImport" style="display:none" />
        <button class="btn btn-sm btn-outline-info flex-shrink-0" @click="exportFullState">Exportar Estado DB</button>
        <button class="btn btn-sm btn-outline-info flex-shrink-0" @click="triggerImportState">Importar Estado DB</button>
        <input type="file" ref="importStateInput" accept=".json" @change="handleImportState" style="display:none" />
      </div>
    </div>

    <div class="row row-cols-1 row-cols-lg-3 g-3 flex-grow-1 overflow-auto" style="min-height: 0;">

      <div class="col" v-if="cardHasVisible(['api key deepseek', 'token redmine', 'url redmine'])">
        <div class="card bg-dark border-secondary h-100">
          <div class="card-header bg-dark border-secondary py-2 px-3">
            <h6 class="mb-0 fw-semibold">Credenciales</h6>
          </div>
          <div class="card-body d-flex flex-column gap-3">
            <div v-if="matches('api key deepseek')">
              <label class="form-label small mb-1">API Key DeepSeek</label>
              <div class="input-group input-group-sm">
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
              <button class="btn btn-sm mt-1 btn-argentina" @click="saveKey">Guardar Key</button>
            </div>

            <div v-if="matches('token redmine')">
              <label class="form-label small mb-1">Token Redmine</label>
              <div class="input-group input-group-sm">
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
              <button class="btn btn-sm mt-1 btn-argentina" @click="saveRedmineToken">Guardar Token</button>
            </div>

            <div v-if="matches('url redmine')">
              <label class="form-label small mb-1">URL Redmine</label>
              <input
                type="text"
                class="form-control form-control-sm bg-dark text-light border-secondary"
                v-model="redmineUrlInput"
                placeholder="https://redmine.tudominio.com"
              />
              <button class="btn btn-sm mt-1 btn-argentina" @click="saveRedmineUrl">Guardar URL</button>
            </div>
          </div>
        </div>
      </div>

      <div class="col" v-if="cardHasVisible(['acronimo rama repositorio git', 'locale idioma', 'debounce omnifiltro', 'colores prioridad'])">
        <div class="card bg-dark border-secondary h-100">
          <div class="card-header bg-dark border-secondary py-2 px-3">
            <h6 class="mb-0 fw-semibold">Preferencias</h6>
          </div>
          <div class="card-body d-flex flex-column gap-3">
            <div v-if="matches('acronimo rama repositorio git')">
              <label class="form-label small mb-1">Acrónimo para ramas Git</label>
              <input
                type="text"
                class="form-control form-control-sm bg-dark text-light border-secondary"
                v-model="repoAcronimoInput"
                placeholder="TKT"
              />
              <button class="btn btn-sm mt-1 btn-argentina" @click="saveRepoAcronimo">Guardar</button>
            </div>

            <div v-if="matches('locale idioma')">
              <label class="form-label small mb-1">Locale (idioma del agente OpenCode)</label>
              <input
                type="text"
                class="form-control form-control-sm bg-dark text-light border-secondary"
                v-model="localeInput"
                placeholder="es_ES.UTF-8"
              />
              <button class="btn btn-sm mt-1 btn-argentina" @click="saveLocale">Guardar</button>
            </div>

            <div v-if="matches('debounce omnifiltro')">
              <label class="form-label small mb-1">Omnifiltro — Tiempo de debounce (ms)</label>
              <input
                type="number"
                class="form-control form-control-sm bg-dark text-light border-secondary"
                v-model.number="omnifilterDebounceInput"
                min="0"
                step="100"
                placeholder="2000"
              />
              <button class="btn btn-sm mt-1 btn-argentina" @click="saveOmnifilterDebounce">Guardar</button>
            </div>

            <div v-if="matches('colores prioridad')">
              <label class="form-label small mb-2 fw-semibold">Colores de Prioridad</label>
              <div class="d-flex align-items-center gap-2 mb-1">
                <span class="small text-nowrap" style="width: 75px;">Baja</span>
                <input type="color" class="form-control form-control-color bg-dark border-secondary p-1" style="width: 42px; height: 28px;" v-model="priorityColorLowInput" />
                <input type="text" class="form-control bg-dark text-light border-secondary font-monospace small" style="width: 90px;" v-model="priorityColorLowInput" placeholder="#hex" />
                <button class="btn btn-sm btn-argentina ms-auto" @click="savePriorityColor('priority_color_low')">Guardar</button>
              </div>
              <div class="d-flex align-items-center gap-2 mb-1">
                <span class="small text-nowrap" style="width: 75px;">Normal</span>
                <input type="color" class="form-control form-control-color bg-dark border-secondary p-1" style="width: 42px; height: 28px;" v-model="priorityColorNormalInput" />
                <input type="text" class="form-control bg-dark text-light border-secondary font-monospace small" style="width: 90px;" v-model="priorityColorNormalInput" placeholder="#hex" />
                <button class="btn btn-sm btn-argentina ms-auto" @click="savePriorityColor('priority_color_normal')">Guardar</button>
              </div>
              <div class="d-flex align-items-center gap-2 mb-1">
                <span class="small text-nowrap" style="width: 75px;">Alta</span>
                <input type="color" class="form-control form-control-color bg-dark border-secondary p-1" style="width: 42px; height: 28px;" v-model="priorityColorHighInput" />
                <input type="text" class="form-control bg-dark text-light border-secondary font-monospace small" style="width: 90px;" v-model="priorityColorHighInput" placeholder="#hex" />
                <button class="btn btn-sm btn-argentina ms-auto" @click="savePriorityColor('priority_color_high')">Guardar</button>
              </div>
              <div class="d-flex align-items-center gap-2 mb-1">
                <span class="small text-nowrap" style="width: 75px;">Urgente</span>
                <input type="color" class="form-control form-control-color bg-dark border-secondary p-1" style="width: 42px; height: 28px;" v-model="priorityColorUrgentInput" />
                <input type="text" class="form-control bg-dark text-light border-secondary font-monospace small" style="width: 90px;" v-model="priorityColorUrgentInput" placeholder="#hex" />
                <button class="btn btn-sm btn-argentina ms-auto" @click="savePriorityColor('priority_color_urgent')">Guardar</button>
              </div>
              <div class="d-flex align-items-center gap-2 mb-1">
                <span class="small text-nowrap" style="width: 75px;">Inmediata</span>
                <input type="color" class="form-control form-control-color bg-dark border-secondary p-1" style="width: 42px; height: 28px;" v-model="priorityColorImmediateInput" />
                <input type="text" class="form-control bg-dark text-light border-secondary font-monospace small" style="width: 90px;" v-model="priorityColorImmediateInput" placeholder="#hex" />
                <button class="btn btn-sm btn-argentina ms-auto" @click="savePriorityColor('priority_color_immediate')">Guardar</button>
              </div>
            </div>
          </div>
        </div>
      </div>

      <div class="col" v-if="cardHasVisible(['system prompt del agente', 'descripcion ticket prompt redactar', 'refinar descripcion ticket prompt', 'deteccion funcionalidades prompt deteccion_funcionalidades'])">
        <div class="card bg-dark border-secondary h-100">
          <div class="card-header bg-dark border-secondary py-2 px-3">
            <h6 class="mb-0 fw-semibold">Prompts del Sistema</h6>
          </div>
          <div class="card-body d-flex flex-column gap-3">
            <div v-if="matches('system prompt del agente')">
              <label class="form-label small mb-1">System Prompt del agente</label>
              <textarea
                class="form-control font-monospace bg-dark text-light border-secondary"
                rows="5"
                v-model="promptInput"
              ></textarea>
              <button class="btn btn-sm mt-1 btn-argentina" @click="savePrompt">Guardar Prompt</button>
            </div>

            <div v-if="matches('descripcion ticket prompt redactar')">
              <label class="form-label small mb-1">Prompt — Redactar Descripción Ticket</label>
              <textarea
                class="form-control font-monospace bg-dark text-light border-secondary"
                rows="3"
                v-model="descripcionPromptInput"
              ></textarea>
              <button class="btn btn-sm mt-1 btn-argentina" @click="saveDescripcionPrompt">Guardar Prompt</button>
            </div>

            <div v-if="matches('refinar descripcion ticket prompt')">
              <label class="form-label small mb-1">Prompt — Refinar Descripción Ticket</label>
              <textarea
                class="form-control font-monospace bg-dark text-light border-secondary"
                rows="3"
                v-model="refinarPromptInput"
              ></textarea>
              <button class="btn btn-sm mt-1 btn-argentina" @click="saveRefinarPrompt">Guardar Prompt</button>
            </div>

            <div v-if="matches('deteccion funcionalidades prompt deteccion_funcionalidades')">
              <label class="form-label small mb-1">Prompt — Detección de Funcionalidades</label>
              <textarea
                class="form-control font-monospace bg-dark text-light border-secondary"
                rows="3"
                v-model="deteccionPromptInput"
              ></textarea>
              <button class="btn btn-sm mt-1 btn-argentina" @click="saveDeteccionPrompt">Guardar Prompt</button>
            </div>
          </div>
        </div>
      </div>

      <div class="col" v-if="cardHasVisible(['base de datos', 'subproyectos', 'endpoints', 'websockets', 'funcionalidades'])">
        <div class="card bg-dark border-secondary h-100">
          <div class="card-header bg-dark border-secondary py-2 px-3">
            <h6 class="mb-0 fw-semibold">Prompts de Documentación</h6>
          </div>
          <div class="card-body d-flex flex-column gap-3">
            <div v-if="matches('base de datos')">
              <label class="form-label small mb-1">Base de Datos</label>
              <textarea
                class="form-control font-monospace bg-dark text-light border-secondary"
                rows="3"
                v-model="docBdInput"
              ></textarea>
              <button class="btn btn-sm mt-1 btn-argentina" @click="saveDoc('base_datos')">Guardar Prompt</button>
            </div>

            <div v-if="matches('subproyectos')">
              <label class="form-label small mb-1">Subproyectos</label>
              <textarea
                class="form-control font-monospace bg-dark text-light border-secondary"
                rows="3"
                v-model="docSubInput"
              ></textarea>
              <button class="btn btn-sm mt-1 btn-argentina" @click="saveDoc('subproyectos')">Guardar Prompt</button>
            </div>

            <div v-if="matches('endpoints')">
              <label class="form-label small mb-1">Endpoints</label>
              <textarea
                class="form-control font-monospace bg-dark text-light border-secondary"
                rows="3"
                v-model="docEndpointsInput"
              ></textarea>
              <button class="btn btn-sm mt-1 btn-argentina" @click="saveDoc('endpoints')">Guardar Prompt</button>
            </div>

            <div v-if="matches('websockets')">
              <label class="form-label small mb-1">WebSockets</label>
              <textarea
                class="form-control font-monospace bg-dark text-light border-secondary"
                rows="3"
                v-model="docWsInput"
              ></textarea>
              <button class="btn btn-sm mt-1 btn-argentina" @click="saveDoc('web_sockets')">Guardar Prompt</button>
            </div>

            <div v-if="matches('funcionalidades')">
              <label class="form-label small mb-1">Funcionalidades</label>
              <textarea
                class="form-control font-monospace bg-dark text-light border-secondary"
                rows="3"
                v-model="docFuncInput"
              ></textarea>
              <button class="btn btn-sm mt-1 btn-argentina" @click="saveDoc('funcionalidades')">Guardar Prompt</button>
            </div>
          </div>
        </div>
      </div>

      <div class="col" v-if="cardHasVisible(['codigo extensiones archivos code_file', 'intervalo reproduccion navegador', 'limite respuesta peticion http', 'resoluciones pantalla resolucion'])">
        <div class="card bg-dark border-secondary h-100">
          <div class="card-header bg-dark border-secondary py-2 px-3">
            <h6 class="mb-0 fw-semibold">Opciones Técnicas</h6>
          </div>
          <div class="card-body d-flex flex-column gap-3">
            <div v-if="matches('codigo extensiones archivos code_file')">
              <label class="form-label small mb-1 fw-semibold">Archivos de Código</label>
              <div class="small text-muted mb-1">Extensiones (separadas por coma) y tamaño máximo en KB</div>
              <div class="d-flex gap-2 align-items-start">
                <div style="flex: 1;">
                  <input type="text" class="form-control form-control-sm bg-dark text-light border-secondary font-monospace" v-model="codeExtensionsInput" placeholder=".js,.vue,.py,..." />
                </div>
                <div style="width: 90px;">
                  <input type="number" class="form-control form-control-sm bg-dark text-light border-secondary font-monospace" v-model.number="codeMaxSizeInput" min="1" placeholder="KB" />
                </div>
              </div>
              <button class="btn btn-sm mt-1 btn-argentina" @click="saveCodeConfig">Guardar</button>
            </div>

            <div v-if="matches('intervalo reproduccion navegador')">
              <label class="form-label small mb-1">Intervalo de Reproducción del Navegador (ms)</label>
              <div class="small text-muted mb-1">Tiempo entre cada acción al reproducir grabaciones</div>
              <input
                type="number"
                class="form-control form-control-sm bg-dark text-light border-secondary"
                v-model.number="replayIntervalInput"
                min="100"
                step="100"
                placeholder="1000"
                style="max-width: 160px;"
              />
              <button class="btn btn-sm mt-1 btn-argentina" @click="saveReplayInterval">Guardar</button>
            </div>

            <div v-if="matches('limite respuesta peticion http')">
              <label class="form-label small mb-1">Límite de respuesta — Peticiones HTTP (KB)</label>
              <div class="small text-muted mb-1">Tamaño máximo del body al usar /peticion. Si se excede, la respuesta se trunca.</div>
              <input
                type="number"
                class="form-control form-control-sm bg-dark text-light border-secondary"
                v-model.number="requestResponseMaxSizeInput"
                min="1"
                step="10"
                placeholder="100"
                style="max-width: 160px;"
              />
              <button class="btn btn-sm mt-1 btn-argentina" @click="saveRequestResponseMaxSize">Guardar</button>
            </div>

            <div v-if="matches('resoluciones pantalla resolucion')">
              <label class="form-label small mb-1 fw-semibold">Resoluciones de Pantalla</label>
              <div class="small text-muted mb-1">Usadas por /navegador_iniciar --resolution=ID</div>
              <div v-for="(res, i) in resolutionsEdit" :key="i" class="d-flex gap-1 mb-1 align-items-center">
                <input type="text" class="form-control form-control-sm bg-dark text-light border-secondary font-monospace" style="width: 100px;" placeholder="id" v-model="resolutionsEdit[i].id" />
                <input type="number" class="form-control form-control-sm bg-dark text-light border-secondary font-monospace" style="width: 65px;" placeholder="ancho" v-model.number="resolutionsEdit[i].width" min="1" />
                <span class="text-muted small">x</span>
                <input type="number" class="form-control form-control-sm bg-dark text-light border-secondary font-monospace" style="width: 65px;" placeholder="alto" v-model.number="resolutionsEdit[i].height" min="1" />
                <button class="btn btn-sm btn-outline-danger py-0 px-1" @click="removeResolution(i)" title="Eliminar">✕</button>
              </div>
              <div class="d-flex gap-1 mb-1 align-items-center">
                <input type="text" class="form-control form-control-sm bg-dark text-light border-secondary font-monospace" style="width: 100px;" placeholder="nuevo id" v-model="newResId" />
                <input type="number" class="form-control form-control-sm bg-dark text-light border-secondary font-monospace" style="width: 65px;" placeholder="ancho" v-model.number="newResWidth" min="1" />
                <span class="text-muted small">x</span>
                <input type="number" class="form-control form-control-sm bg-dark text-light border-secondary font-monospace" style="width: 65px;" placeholder="alto" v-model.number="newResHeight" min="1" />
                <button class="btn btn-sm btn-outline-argentina py-0 px-1" @click="addResolution">+</button>
                <button class="btn btn-sm btn-outline-secondary py-0 px-1" @click="resetResolutions" title="Restaurar valores por defecto">↺</button>
              </div>
              <button class="btn btn-sm btn-argentina" @click="saveResolutions">Guardar Resoluciones</button>
            </div>
          </div>
        </div>
      </div>

      <div class="col" v-if="cardHasVisible(['ambientes entorno dev tst prd'])">
        <div class="card bg-dark border-secondary h-100">
          <div class="card-header bg-dark border-secondary py-2 px-3">
            <h6 class="mb-0 fw-semibold">Ambientes</h6>
          </div>
          <div class="card-body d-flex flex-column gap-2">
            <div v-if="matches('ambientes entorno dev tst prd')">
              <div class="small text-muted mb-1">Ambientes de trabajo con rama y descripción</div>
              <div v-for="(env, i) in envStore.list" :key="env.id || i" class="d-flex gap-1 mb-1 align-items-center">
                <input type="text" class="form-control form-control-sm bg-dark text-light border-secondary font-monospace" style="width: 70px;" placeholder="nombre" v-model="envStore.list[i].name" />
                <input type="text" class="form-control form-control-sm bg-dark text-light border-secondary font-monospace" style="width: 85px;" placeholder="rama" v-model="envStore.list[i].branch" />
                <input type="text" class="form-control form-control-sm bg-dark text-light border-secondary" style="flex: 1;" placeholder="descripción" v-model="envStore.list[i].description" />
                <button class="btn btn-sm btn-outline-argentina py-0 px-1" @click="envStore.save(i, selectedWId)" title="Guardar">✓</button>
                <button class="btn btn-sm btn-outline-danger py-0 px-1" @click="envStore.remove(i)" title="Eliminar" v-if="envStore.list[i].id">✕</button>
              </div>
              <div class="d-flex gap-1 mt-1 align-items-center">
                <input type="text" class="form-control form-control-sm bg-dark text-light border-secondary font-monospace" style="width: 70px;" placeholder="nombre" v-model="newEnvName" />
                <input type="text" class="form-control form-control-sm bg-dark text-light border-secondary font-monospace" style="width: 85px;" placeholder="rama" v-model="newEnvBranch" />
                <input type="text" class="form-control form-control-sm bg-dark text-light border-secondary" style="flex: 1;" placeholder="descripción" v-model="newEnvDescription" />
                <button class="btn btn-sm btn-outline-argentina py-0 px-1" @click="addEnvironment">+ Agregar</button>
              </div>
            </div>
          </div>
        </div>
      </div>

    </div>

    <div class="flex-shrink-0">
      <div v-if="settings.saveSuccess" class="alert alert-success py-2 small mb-0">{{ settings.saveSuccess }}</div>
      <div v-if="settings.saveError" class="alert alert-danger py-2 small mb-0">{{ settings.saveError }}</div>
      <div v-if="wsMessage" class="alert alert-info py-2 small mb-0">{{ wsMessage }}</div>
      <div v-if="envStore.message" class="alert alert-info py-2 small mb-0">{{ envStore.message }}</div>
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
import { useEnvironmentsStore } from '../stores/environments.js'
import WorkspaceFormModal from '../components/WorkspaceFormModal.vue'

export default {
  setup() {
    const settings = useSettingsStore()
    const wsStore = useWorkspaceStore()
    const chatStore = useChatStore()
    const auth = useAuthStore()
    const modal = useModalStore()
    const envStore = useEnvironmentsStore()
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
    const replayIntervalInput = ref(1000)
    const requestResponseMaxSizeInput = ref(100)
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

    function cardHasVisible(labels) {
      if (!searchTerm.value) return true
      const term = searchTerm.value.toLowerCase()
      return labels.some(label => label.toLowerCase().includes(term))
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
      selectedWId.value = auth.getPrimaryWorkspaceId()
      if (!selectedWId.value || !workspaces.value.find(w => w.id === selectedWId.value)) {
        selectedWId.value = 1
      }
      await settings.load(selectedWId.value)
      await envStore.load(selectedWId.value)
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

    watch(() => settings.requestResponseMaxSizeKb, (val) => {
      requestResponseMaxSizeInput.value = val
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
      await settings.load(selectedWId.value)
      await envStore.load(selectedWId.value)
    }

    async function onWorkspaceChange() {
      const newId = selectedWId.value
      await settings.load(newId)
      await envStore.load(newId)
    }

    const deleteConfirmWs = ref(null)
    const deleting = ref(false)

    function openCreateModal() {
      modal.open(WorkspaceFormModal, {}, { title: 'Nuevo espacio de trabajo' })
    }

    function openEditModal() {
      const ws = workspaces.value.find(w => w.id === selectedWId.value)
      if (!ws) return
      modal.open(WorkspaceFormModal, { workspace: { id: ws.id, name: ws.name, color: ws.color } }, { title: 'Editar espacio de trabajo' })
    }

    function openDeleteConfirm() {
      const ws = workspaces.value.find(w => w.id === selectedWId.value)
      if (ws) deleteConfirmWs.value = ws
    }

    function cancelDelete() {
      deleteConfirmWs.value = null
    }

    async function executeDelete() {
      if (!deleteConfirmWs.value) return
      deleting.value = true
      const ws = deleteConfirmWs.value
      wsMessage.value = 'Eliminando espacio de trabajo...'
      const result = await wsStore.deleteWorkspace(ws.id)
      if (result.success) {
        workspaces.value = workspaces.value.filter(w => w.id !== ws.id)
        selectedWId.value = 1
        const currentIds = auth.getWorkspaceIds()
        auth.setWorkspaceIds(currentIds.filter(id => id !== ws.id))
        if (currentIds.includes(ws.id)) {
          await wsStore.selectWorkspaces(auth.getWorkspaceIds())
        }
        chatStore.stopAllExecutions()
        await wsStore.loadWorkspaces()
        await reloadSettings()
        wsMessage.value = 'Espacio de trabajo eliminado.'
        setTimeout(() => { wsMessage.value = '' }, 3000)
      } else {
        wsMessage.value = result.error || 'Error al eliminar.'
      }
      deleteConfirmWs.value = null
      deleting.value = false
    }

    function saveKey() {
      settings.clearFeedback()
      settings.save('deepseek_key', keyInput.value, selectedWId.value)
    }

    function saveRedmineToken() {
      settings.clearFeedback()
      settings.save('redmine_token', redmineTokenInput.value, selectedWId.value)
    }

    function saveRedmineUrl() {
      settings.clearFeedback()
      settings.save('redmine_url', redmineUrlInput.value, selectedWId.value)
    }

    function savePrompt() {
      settings.clearFeedback()
      settings.save('system_prompt', promptInput.value, selectedWId.value)
    }

    function saveDoc(tipo) {
      settings.clearFeedback()
      settings.save('documentacion_prompt_' + tipo, DOC_INPUTS[tipo].value, selectedWId.value)
    }

    function saveOmnifilterDebounce() {
      settings.clearFeedback()
      settings.save('omnifilter_debounce_ms', String(omnifilterDebounceInput.value), selectedWId.value)
    }

    function saveDescripcionPrompt() {
      settings.clearFeedback()
      settings.save('ticket_descripcion_prompt', descripcionPromptInput.value, selectedWId.value)
    }

    function saveRepoAcronimo() {
      settings.clearFeedback()
      settings.save('repo_acronimo', repoAcronimoInput.value, selectedWId.value)
    }

    function saveRefinarPrompt() {
      settings.clearFeedback()
      settings.save('ticket_refinar_prompt', refinarPromptInput.value, selectedWId.value)
    }

    function saveDeteccionPrompt() {
      settings.clearFeedback()
      settings.save('deteccion_funcionalidades_prompt', deteccionPromptInput.value, selectedWId.value)
    }

    function saveCodeConfig() {
      settings.clearFeedback()
      settings.save('code_file_extensions', codeExtensionsInput.value, selectedWId.value)
      settings.save('code_file_max_size_kb', String(codeMaxSizeInput.value), selectedWId.value)
    }

    function saveLocale() {
      settings.clearFeedback()
      settings.save('locale', localeInput.value, selectedWId.value)
    }

    function saveReplayInterval() {
      settings.clearFeedback()
      settings.save('replay_interval_ms', String(replayIntervalInput.value), selectedWId.value)
    }

    function saveRequestResponseMaxSize() {
      settings.clearFeedback()
      settings.save('request_response_max_size_kb', String(requestResponseMaxSizeInput.value), selectedWId.value)
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
      settings.save(key, inputMap[key].value, selectedWId.value)
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
      settings.save('screen_resolutions', JSON.stringify(valid), selectedWId.value)
    }

    async function addEnvironment() {
      await envStore.add({
        name: newEnvName.value.trim(),
        branch: newEnvBranch.value.trim(),
        description: newEnvDescription.value.trim(),
        workspaceId: selectedWId.value,
      })
      if (envStore.message === 'Ambiente creado.') {
        newEnvName.value = ''
        newEnvBranch.value = ''
        newEnvDescription.value = ''
      }
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
      newEnvName, newEnvBranch, newEnvDescription,
      replayIntervalInput,
      requestResponseMaxSizeInput,
      saveKey, saveRedmineToken, saveRedmineUrl, savePrompt, saveDoc,
      saveOmnifilterDebounce, saveDescripcionPrompt, saveRefinarPrompt, saveDeteccionPrompt, saveCodeConfig, saveRepoAcronimo,
      saveLocale, savePriorityColor, saveReplayInterval, saveRequestResponseMaxSize,
      addResolution, removeResolution, resetResolutions, saveResolutions, matches, cardHasVisible,
      envStore, wsMessage,
      onWorkspaceChange, openCreateModal, openEditModal, openDeleteConfirm, cancelDelete, executeDelete, deleteConfirmWs, deleting,
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
