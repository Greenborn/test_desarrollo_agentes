<template>
  <div>
    <label class="small text-secondary mb-1">El prompt define el formato JSON de salida:</label>
    <textarea v-model="editPrompt" class="form-control form-control-sm bg-dark text-light border-secondary"
      style="font-size:0.75rem;min-height:200px;" placeholder="Define el formato JSON de salida obligatorio..."></textarea>
    <div class="d-flex gap-2 justify-content-end mt-3">
      <button class="btn btn-sm btn-outline-secondary py-0 px-3" style="font-size:0.7rem;" @click="$emit('close')">Cancelar</button>
      <button class="btn btn-sm btn-outline-success py-0 px-3" style="font-size:0.7rem;" @click="save">Guardar</button>
    </div>
  </div>
</template>

<script>
import { ref } from 'vue'
import { settingSet } from '../../../services/settingService.js'

const AGENT_SYSTEM_PROMPT_KEY = 'doc_agent_system_prompt'

export default {
  props: {
    initialPrompt: { type: String, default: '' },
  },
  emits: ['close'],
  setup(props, { emit }) {
    const editPrompt = ref(props.initialPrompt)

    async function save() {
      try {
        await settingSet(AGENT_SYSTEM_PROMPT_KEY, editPrompt.value)
      } catch (err) {
        console.error('Error al guardar prompt del agente:', err)
      }
      emit('close')
    }

    return { editPrompt, save }
  },
}
</script>
