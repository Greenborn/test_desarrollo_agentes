<template>
  <div class="project-command-toggle d-flex flex-column gap-1 mb-2">
    <label class="d-flex align-items-center gap-2 mb-0" style="color: #9ca3af; font-size: 0.8rem; cursor: pointer;">
      <input
        type="checkbox"
        class="form-check-input"
        :checked="enabled"
        :disabled="commands.length === 0"
        style="cursor: pointer;"
        @change="onToggle"
      />
      {{ label }}
    </label>
    <select
      v-if="enabled"
      v-model="commandId"
      class="form-select form-select-sm bg-dark text-light border-secondary font-monospace"
      style="max-width: 100%;"
      @change="onSelect"
    >
      <option value="" disabled>Selecciona comando del proyecto...</option>
      <option v-for="c in commands" :key="c.id" :value="c.id">{{ c.label }}</option>
    </select>
    <div v-if="commands.length === 0" class="small" style="color: #6b7280; font-size: 0.7rem;">
      No hay comandos personalizados para este proyecto.
    </div>
  </div>
</template>

<script>
import { ref } from 'vue'

export default {
  name: 'ProjectCommandToggle',
  props: {
    label: { type: String, default: 'Ejecutar comando del proyecto al confirmar' },
    enabled: { type: Boolean, default: false },
    commandId: { type: [Number, String], default: '' },
    commands: { type: Array, default: () => [] },
  },
  emits: ['update:enabled', 'update:commandId'],
  setup(props, { emit }) {
    const commandId = ref(props.commandId)

    function onToggle(e) {
      emit('update:enabled', !!e.target.checked)
      if (!e.target.checked) {
        commandId.value = ''
        emit('update:commandId', '')
      }
    }

    function onSelect() {
      emit('update:commandId', commandId.value)
    }

    return { commandId, onToggle, onSelect }
  },
}
</script>

<style scoped>
</style>
