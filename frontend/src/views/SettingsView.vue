<template>
  <div class="d-flex flex-column vh-100">
    <Topbar />
    <div class="container py-4 text-light" style="max-width: 640px;">
      <h5 class="mb-4">Configuración</h5>
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

      <div v-if="settings.saveSuccess" class="alert alert-success py-2 small">{{ settings.saveSuccess }}</div>
      <div v-if="settings.saveError" class="alert alert-danger py-2 small">{{ settings.saveError }}</div>
    </div>
  </div>
</template>

<script>
import { ref, onMounted, watch } from 'vue'
import Topbar from '../components/Topbar.vue'
import { useSettingsStore } from '../stores/settings.js'

export default {
  components: { Topbar },
  setup() {
    const settings = useSettingsStore()
    const keyInput = ref('')
    const promptInput = ref('')
    const docBdInput = ref('')
    const docSubInput = ref('')
    const docEndpointsInput = ref('')
    const docWsInput = ref('')
    const docFuncInput = ref('')
    const showKey = ref(false)
    const searchTerm = ref('')

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

    for (const [key, refName] of Object.entries(DOC_STORE_MAP)) {
      watch(() => settings[refName], (val) => {
        DOC_INPUTS[key].value = val
      }, { immediate: true })
    }

    function saveKey() {
      settings.clearFeedback()
      settings.save('deepseek_key', keyInput.value)
    }

    function savePrompt() {
      settings.clearFeedback()
      settings.save('system_prompt', promptInput.value)
    }

    function saveDoc(tipo) {
      settings.clearFeedback()
      settings.save('documentacion_prompt_' + tipo, DOC_INPUTS[tipo].value)
    }

    return {
      keyInput, promptInput, docBdInput, docSubInput, docEndpointsInput, docWsInput, docFuncInput, showKey, searchTerm,
      settings,
      saveKey, savePrompt, saveDoc, matches,
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
