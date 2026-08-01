<template>
  <div class="commit-result-control">
    <template v-if="!loading">
      <div class="mb-2" style="color: #9ca3af; font-size: 0.8rem;">Propuesta de commit:</div>
      <textarea
        v-model="editedMessage"
        class="form-control bg-dark text-light border-secondary font-monospace p-3 mb-2 rounded-3"
        style="min-height: 100px; resize: vertical; font-size: 0.875rem;"
      ></textarea>
      <div v-if="repoUrl" class="mb-2" style="color: #9ca3af; font-size: 0.8rem;">
        Repositorio: <a :href="repoUrl" target="_blank" rel="noopener noreferrer" style="color: #75AADB; text-decoration: none;">{{ repoUrl }}</a>
      </div>
      <label class="d-flex align-items-center gap-2 mb-2" style="color: #9ca3af; font-size: 0.8rem; cursor: pointer;">
        <input type="checkbox" v-model="addComment" class="form-check-input" style="cursor: pointer;" />
        Agregar comentario al ticket
      </label>
      <ProjectCommandToggle
        :label="runCommandLabel"
        :enabled="runCommandEnabled"
        :command-id="runCommandId"
        :commands="commands"
        @update:enabled="onRunCommandEnabled"
        @update:command-id="onRunCommandId"
      />
      <div class="d-flex align-items-center gap-2 mb-2">
        <label class="small text-light-emphasis mb-0" style="color: #9ca3af; font-size: 0.8rem;">Modo envío:</label>
        <select v-model="modoEnvio" class="form-select form-select-sm bg-dark text-light border-secondary font-monospace" style="width: auto;">
          <option value="encolar">Encolar</option>
          <option value="enviar">Enviar</option>
        </select>
      </div>
      <div class="d-flex gap-2">
        <button class="btn btn-sm btn-success" @click="confirmar">
          Confirmar
        </button>
        <button class="btn btn-sm btn-argentina" @click="reintentar">
          Reintentar
        </button>
        <button class="btn btn-sm btn-outline-argentina" @click="cancelar">
          Cancelar
        </button>
      </div>
    </template>
    <div v-else class="d-flex flex-column align-items-center gap-2 py-3">
      <div class="spinner-border text-success" role="status" style="width: 2rem; height: 2rem;"></div>
      <span style="color: #9ca3af; font-size: 0.875rem;">Procesando commit...</span>
    </div>
  </div>
</template>

<script>
import { ref } from 'vue'
import ProjectCommandToggle from './ProjectCommandToggle.vue'

export default {
  components: { ProjectCommandToggle },
  props: {
    message: { type: String, required: true },
    loading: { type: Boolean, default: false },
    modoEnvioInicial: { type: String, default: 'encolar' },
    repoUrl: { type: String, default: '' },
    runCommandEnabled: { type: Boolean, default: false },
    runCommandId: { type: [Number, String], default: '' },
    commands: { type: Array, default: () => [] },
    runCommandLabel: { type: String, default: 'Ejecutar comando del proyecto después del commit' },
  },
  emits: ['confirm', 'update:runCommandEnabled', 'update:runCommandId'],
  setup(props, { emit }) {
    const editedMessage = ref(props.message)
    const addComment = ref(true)
    const modoEnvio = ref(props.modoEnvioInicial || 'encolar')

    function onRunCommandEnabled(val) {
      emit('update:runCommandEnabled', val)
      if (!val) emit('update:runCommandId', '')
    }

    function onRunCommandId(id) {
      emit('update:runCommandId', id)
    }

    function confirmar() {
      emit('confirm', {
        action: 'confirm',
        message: editedMessage.value,
        addComment: addComment.value,
        modo_envio: modoEnvio.value,
        runCommandEnabled: props.runCommandEnabled,
        runCommandId: props.runCommandId,
      })
    }

    function reintentar() {
      emit('confirm', { action: 'retry' })
    }

    function cancelar() {
      emit('confirm', null)
    }

    return { editedMessage, addComment, modoEnvio, confirmar, reintentar, cancelar, onRunCommandEnabled, onRunCommandId }
  },
}
</script>

<style scoped>
.btn-success {
  background-color: #22c55e;
  border: 1px solid #22c55e;
  color: #fff;
}
.btn-success:hover {
  background-color: #16a34a;
  border-color: #16a34a;
}
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
</style>
