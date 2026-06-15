<template>
  <div class="d-flex flex-column gap-2">
    <div class="position-relative">
      <input
        ref="inputEl"
        v-model="filterText"
        type="text"
        class="form-control form-control-sm bg-dark text-light border-secondary font-monospace"
        :placeholder="placeholder || 'Filtrar...'"
        @input="onFilter"
        @keydown.enter="confirm()"
        @keydown.down.prevent="onArrow(1)"
        @keydown.up.prevent="onArrow(-1)"
      />
      <div v-if="filteredOptions.length > 0" class="position-absolute top-100 start-0 end-0 bg-dark border border-secondary rounded-bottom" style="z-index: 1050; max-height: 160px; overflow-y: auto;">
        <button
          v-for="(opt, i) in filteredOptions"
          :key="opt.value"
          class="d-block w-100 text-start px-2 py-1 btn btn-sm text-light font-monospace"
          :class="{ 'bg-primary': opt.value === selected }"
          @mousedown.prevent="confirm(opt.value)"
        >
          {{ opt.label }}
        </button>
      </div>
    </div>
    <button class="btn btn-sm btn-success align-self-end" :disabled="!selected" @click="confirm()">
      Confirmar
    </button>
  </div>
</template>

<script>
import { ref, computed } from 'vue'

export default {
  props: {
    options: { type: Array, required: true },
    modelValue: { type: String, default: '' },
    placeholder: { type: String, default: '' },
    preselect: { type: String, default: '' },
  },
  emits: ['confirm', 'update:modelValue'],
  setup(props, { emit }) {
    const inputEl = ref(null)
    const filterText = ref('')
    const selected = ref(props.preselect || '')

    const filteredOptions = computed(() => {
      if (!filterText.value) return props.options
      const q = filterText.value.toLowerCase()
      return props.options.filter((o) => o.label.toLowerCase().includes(q) || o.value.toLowerCase().includes(q))
    })

    function onArrow(dir) {
      const opts = filteredOptions.value
      if (!opts.length) return
      const idx = opts.findIndex((o) => o.value === selected.value)
      let newIdx = idx < 0 ? 0 : (idx + dir + opts.length) % opts.length
      selected.value = opts[newIdx].value
    }

    function onFilter() {
      if (filteredOptions.value.length === 1 && !selected.value) {
        confirm(filteredOptions.value[0].value)
      }
    }

    function confirm(value) {
      const v = value !== undefined ? value : selected.value
      if (!v) return
      emit('update:modelValue', v)
      emit('confirm', v)
    }

    return { inputEl, filterText, selected, filteredOptions, onFilter, onArrow, confirm }
  },
}
</script>
