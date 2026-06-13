<template>
  <div class="d-flex flex-column vh-100">
    <Topbar />
    <div class="container py-4" style="max-width: 640px;">
      <h5 class="mb-4">Configuración</h5>

      <div class="mb-4">
        <label class="form-label">API Key DeepSeek</label>
        <div class="input-group">
          <input
            :type="showKey ? 'text' : 'password'"
            class="form-control"
            v-model="keyInput"
            placeholder="sk-..."
          />
          <button class="btn btn-outline-secondary" @click="showKey = !showKey">
            {{ showKey ? 'Ocultar' : 'Mostrar' }}
          </button>
        </div>
        <button class="btn btn-sm btn-primary mt-2" @click="saveKey">
          Guardar Key
        </button>
      </div>

      <div class="mb-4">
        <label class="form-label">System Prompt del agente</label>
        <textarea
          class="form-control font-monospace"
          rows="8"
          v-model="promptInput"
        ></textarea>
        <button class="btn btn-sm btn-primary mt-2" @click="savePrompt">
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
    const showKey = ref(false)

    onMounted(() => settings.load())

    watch(() => settings.systemPrompt, (val) => {
      promptInput.value = val
    }, { immediate: true })

    watch(() => settings.deepseekKey, (val) => {
      keyInput.value = val
    }, { immediate: true })

    function saveKey() {
      settings.clearFeedback()
      settings.save('deepseek_key', keyInput.value)
    }

    function savePrompt() {
      settings.clearFeedback()
      settings.save('system_prompt', promptInput.value)
    }

    return {
      keyInput, promptInput, showKey,
      settings,
      saveKey, savePrompt,
    }
  },
}
</script>
