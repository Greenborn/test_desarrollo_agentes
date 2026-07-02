<template>
  <div class="d-flex flex-column gap-2">
    <div>
      <label class="form-label text-light small mb-1">Label</label>
      <input
        v-model="label"
        class="form-control form-control-sm bg-dark text-light border-secondary"
        placeholder="Nombre del comando"
        maxlength="255"
      />
    </div>
    <div>
      <label class="form-label text-light small mb-1">Descripción</label>
      <textarea
        v-model="descripcion"
        class="form-control form-control-sm bg-dark text-light border-secondary"
        placeholder="Descripción opcional"
        rows="2"
      ></textarea>
    </div>
    <div>
      <label class="form-label text-light small mb-1">Comando</label>
      <textarea
        v-model="comando"
        class="form-control form-control-sm bg-dark text-light border-secondary font-monospace"
        placeholder="Ej: ls -la"
        rows="3"
        maxlength="512"
      ></textarea>
      <div class="text-end text-muted small mt-1">{{ comando.length }}/512</div>
    </div>
    <div class="d-flex align-items-center gap-2">
      <input id="ocultar-check" type="checkbox" v-model="ocultarEjecucion" class="form-check-input m-0" style="width: 14px; height: 14px; cursor: pointer;" />
      <label for="ocultar-check" class="form-label text-light small mb-0" style="cursor: pointer;">Ocultar ejecución (no mostrar en el chat)</label>
    </div>
    <div class="d-flex gap-2 justify-content-end">
      <button class="btn btn-sm btn-secondary" @click="cancel">Cancelar</button>
      <button class="btn btn-sm btn-success" :disabled="!label.trim() || !comando.trim()" @click="save">
        Guardar
      </button>
    </div>
  </div>
</template>

<script>
import { ref } from 'vue'

export default {
  props: {
    mode: { type: String, default: 'create' },
    label: { type: String, default: '' },
    descripcion: { type: String, default: '' },
    comando: { type: String, default: '' },
    ocultarEjecucion: { type: Boolean, default: false },
  },
  emits: ['confirm'],
  setup(props, { emit }) {
    const label = ref(props.label || '')
    const descripcion = ref(props.descripcion || '')
    const comando = ref(props.comando || '')
    const ocultarEjecucion = ref(props.ocultarEjecucion || false)

    function save() {
      if (!label.value.trim() || !comando.value.trim()) return
      emit('confirm', {
        label: label.value.trim(),
        descripcion: descripcion.value.trim() || '',
        comando: comando.value.trim(),
        ocultarEjecucion: ocultarEjecucion.value,
      })
    }

    function cancel() {
      emit('confirm', null)
    }

    return { label, descripcion, comando, ocultarEjecucion, save, cancel }
  },
}
</script>
