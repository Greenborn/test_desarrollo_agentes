<template>
  <form @submit.prevent="handleSubmit" class="px-3 py-3">
    <div v-for="campo in campos" :key="campo.field" class="mb-3">
      <label class="form-label">{{ campo.headerName || campo.field }}</label>

      <select v-if="campo.type === 'select'" class="form-select" v-model="model[campo.field]">
        <option value="">Seleccionar...</option>
        <option v-for="opt in campo.options" :key="opt" :value="opt">{{ opt }}</option>
      </select>

      <textarea v-else-if="campo.type === 'textarea'" class="form-control" rows="3"
        v-model="model[campo.field]"></textarea>

      <input v-else-if="campo.type === 'number'" type="number" class="form-control"
        v-model.number="model[campo.field]" />

      <input v-else type="text" class="form-control" v-model="model[campo.field]" />
    </div>
  </form>
</template>

<script>
import { ref, onMounted } from 'vue'

export default {
  props: {
    parametros: { type: Object, default: () => ({}) },
  },
  setup(props) {
    const campos = props.parametros.campos || []
    const modelo = props.parametros.modelo || {}
    const onSubmit = props.parametros.onSubmit || null
    const guardado = props.parametros.guardado || null
    const _modalState = props.parametros._modalState || null
    const model = ref({ ...(modelo || {}) })

    onMounted(() => {
      if (_modalState) {
        _modalState.guardar = handleSubmit
      }
    })

    async function handleSubmit() {
      if (!onSubmit) return
      try {
        const res = await onSubmit(model.value)
        if (res && res.stat !== false) {
          if (guardado) guardado()
        }
      } catch (err) {
        console.error('[FormularioGenerico] Error en submit:', err)
      }
    }

    return { model, handleSubmit }
  },
}
</script>
