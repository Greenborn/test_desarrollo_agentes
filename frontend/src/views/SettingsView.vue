<template>
  <div class="container py-4 text-light" style="max-width: 640px;">
    <input
      type="text"
      class="form-control bg-dark text-light border-secondary mb-3"
      placeholder="Buscar configuración..."
      v-model="searchTerm"
    />

    <div class="mb-4" v-if="matches('api key deepseek')">
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

    <div class="mb-4" v-if="matches('token redmine')">
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

    <div class="mb-4" v-if="matches('url redmine')">
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

    <div class="mb-4" v-if="matches('system prompt del agente')">
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

    <div class="mb-4" v-if="matches('base de datos')">
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

    <div class="mb-4" v-if="matches('subproyectos')">
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

    <div class="mb-4" v-if="matches('endpoints')">
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

    <div class="mb-4" v-if="matches('websockets')">
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

    <div class="mb-4" v-if="matches('funcionalidades')">
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

    <div class="mb-4" v-if="matches('descripcion ticket prompt redactar')">
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

    <div class="mb-4" v-if="matches('debounce omnifiltro')">
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

    <div v-if="settings.saveSuccess" class="alert alert-success py-2 small">{{ settings.saveSuccess }}</div>
    <div v-if="settings.saveError" class="alert alert-danger py-2 small">{{ settings.saveError }}</div>
  </div>
</template>

<script>
import { ref, onMounted, watch } from 'vue'
import { useSettingsStore } from '../stores/settings.js'

export default {
  setup() {
    const settings = useSettingsStore()
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
    const omnifilterDebounceInput = ref(2000)

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

    onMounted(() => settings.load())

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

    watch(() => settings.ticketDescripcionPrompt, (val) => {
      descripcionPromptInput.value = val
    }, { immediate: true })

    for (const [key, refName] of Object.entries(DOC_STORE_MAP)) {
      watch(() => settings[refName], (val) => {
        DOC_INPUTS[key].value = val
      }, { immediate: true })
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

    return {
      keyInput, redmineTokenInput, redmineUrlInput, promptInput, docBdInput, docSubInput, docEndpointsInput, docWsInput, docFuncInput, descripcionPromptInput, showKey, showRedmineToken, searchTerm, omnifilterDebounceInput,
      settings,
      saveKey, saveRedmineToken, saveRedmineUrl, savePrompt, saveDoc, saveOmnifilterDebounce, saveDescripcionPrompt, matches,
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
