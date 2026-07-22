<template>
  <div class="git-auth-modal" style="min-width: 400px;">
    <div class="mb-3">
      <p class="text-warning mb-2">⚠ El push requiere autenticación en GitHub.</p>
      <p class="text-muted small mb-3">Ingresá tu usuario y token de acceso personal (classic) de GitHub. El token necesita permisos de <code>repo</code>.</p>
    </div>
    <div class="mb-3">
      <label class="form-label small fw-bold">Usuario de GitHub</label>
      <input
        ref="usernameInput"
        v-model="form.username"
        type="text"
        class="form-control form-control-sm"
        placeholder="tu-usuario"
        @keydown.enter="submit"
      />
    </div>
    <div class="mb-3">
      <label class="form-label small fw-bold">Token de acceso personal (classic)</label>
      <input
        v-model="form.token"
        type="password"
        class="form-control form-control-sm"
        placeholder="ghp_..."
        @keydown.enter="submit"
      />
    </div>
    <div class="d-flex justify-content-end gap-2 mt-2">
      <button class="btn btn-outline-secondary btn-sm" @click="cancel">Cancelar</button>
      <button class="btn btn-argentina btn-sm" :disabled="!valid" @click="submit">Autenticar y reintentar</button>
    </div>
  </div>
</template>

<script>
import { ref, reactive, computed, onMounted } from 'vue'

export default {
  props: {
    remoteUrl: { type: String, default: '' },
    onSubmit: { type: Function, default: null },
    onCancel: { type: Function, default: null },
  },
  emits: ['close'],
  setup(props, { emit }) {
    const usernameInput = ref(null)
    const form = reactive({
      username: '',
      token: '',
    })

    const valid = computed(() => form.username.trim() && form.token.trim())

    function submit() {
      if (!valid.value) return
      if (props.onSubmit) props.onSubmit({ username: form.username.trim(), token: form.token.trim() })
      emit('close')
    }

    function cancel() {
      if (props.onCancel) props.onCancel()
      emit('close')
    }

    onMounted(() => {
      if (usernameInput.value) usernameInput.value.focus()
    })

    return { form, valid, usernameInput, submit, cancel }
  },
}
</script>
