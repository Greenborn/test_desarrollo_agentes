<template>
  <div class="d-flex flex-column gap-2">
    <div class="d-flex gap-2">
      <select
        v-model="method"
        class="form-select form-select-sm bg-dark text-light border-secondary"
        style="width: 110px; flex-shrink: 0;"
      >
        <option v-for="m in methods" :key="m" :value="m">{{ m }}</option>
      </select>
      <input
        v-model="url"
        class="form-control form-control-sm bg-dark text-light border-secondary font-monospace"
        placeholder="https://api.ejemplo.com/recurso"
        @keydown.enter.prevent="send"
      />
    </div>

    <div>
      <div class="d-flex align-items-center gap-2 mb-1">
        <label class="form-label text-light small mb-0">Headers</label>
        <button class="btn btn-sm btn-outline-argentina py-0 px-2" @click="addHeader">+ Agregar</button>
      </div>
      <div v-for="(h, i) in headers" :key="i" class="d-flex gap-1 mb-1">
        <input
          v-model="h.key"
          class="form-control form-control-sm bg-dark text-light border-secondary font-monospace"
          style="flex: 1; min-width: 0;"
          placeholder="Key"
        />
        <input
          v-model="h.value"
          class="form-control form-control-sm bg-dark text-light border-secondary font-monospace"
          style="flex: 2; min-width: 0;"
          placeholder="Value"
        />
        <button class="btn btn-sm btn-outline-danger py-0 px-2" @click="removeHeader(i)" title="Eliminar header">✕</button>
      </div>
    </div>

    <div v-if="showBody">
      <label class="form-label text-light small mb-1">Body</label>
      <textarea
        v-model="body"
        class="form-control form-control-sm bg-dark text-light border-secondary font-monospace"
        rows="5"
        placeholder='{"key": "value"}'
      ></textarea>
    </div>

    <div class="d-flex gap-2 justify-content-end">
      <button class="btn btn-sm btn-secondary" @click="cancel">Cancelar</button>
      <button class="btn btn-sm btn-success" :disabled="!url.trim()" @click="send">
        <span v-if="sending" class="spinner-border spinner-border-sm me-1"></span>
        Enviar
      </button>
    </div>
  </div>
</template>

<script>
import { ref, computed } from 'vue'

export default {
  props: {
    sending: { type: Boolean, default: false },
  },
  emits: ['confirm'],
  setup(props, { emit }) {
    const methods = ['GET', 'POST', 'PUT', 'DELETE', 'PATCH', 'HEAD', 'OPTIONS']
    const method = ref('GET')
    const url = ref('')
    const headers = ref([])
    const body = ref('')

    const showBody = computed(() => !['GET', 'HEAD', 'OPTIONS'].includes(method.value))

    function addHeader() {
      headers.value.push({ key: '', value: '' })
    }

    function removeHeader(i) {
      headers.value.splice(i, 1)
    }

    function send() {
      if (!url.value.trim()) return
      emit('confirm', {
        url: url.value.trim(),
        method: method.value,
        headers: headers.value.filter(h => h.key.trim()),
        body: showBody.value ? body.value : '',
      })
    }

    function cancel() {
      emit('confirm', null)
    }

    return { methods, method, url, headers, body, showBody, addHeader, removeHeader, send, cancel }
  },
}
</script>
