<template>
  <div>
    <div class="mb-2">
      <label class="form-label">Slug</label>
      <input
        v-model="slugValue"
        class="form-control form-control-sm bg-dark text-light border-secondary font-monospace"
        placeholder="ej: especificacion-api-rest"
        :readonly="!!initialSlug"
        maxlength="100"
      />
      <small class="text-muted">Solo letras, números, guiones y guiones bajos</small>
    </div>

    <div class="mb-2">
      <div class="d-flex gap-2 mb-1">
        <button
          class="btn btn-sm"
          :class="tab === 'editor' ? 'btn-argentina' : 'btn-outline-argentina'"
          @click="tab = 'editor'"
        >Editor</button>
        <button
          class="btn btn-sm"
          :class="tab === 'preview' ? 'btn-argentina' : 'btn-outline-argentina'"
          @click="tab = 'preview'"
        >Vista previa</button>
      </div>

      <textarea
        v-if="tab === 'editor'"
        v-model="contentValue"
        class="form-control font-monospace bg-dark text-light border-secondary"
        style="min-height: 400px; resize: vertical;"
        placeholder="# Título de la plantilla&#10;&#10;Contenido en Markdown..."
        maxlength="10000"
        :disabled="isProtected"
      ></textarea>

      <div
        v-else
        class="p-3 rounded"
        style="min-height: 400px; background: #1a2744; color: #e0e0e0; overflow-y: auto;"
      >
        <ChatFormatter v-if="contentValue" :text="contentValue" />
        <span v-else class="text-muted">(sin contenido)</span>
      </div>
      <small class="text-muted">{{ contentValue.length }} / 10000 caracteres</small>
    </div>

    <div v-if="isProtected" class="alert alert-warning py-1 px-2 mb-2 small">
      Esta es una plantilla protegida del sistema y no puede modificarse.
    </div>

    <div v-if="saveError" class="alert alert-danger py-1 px-2 mb-2 small">{{ saveError }}</div>

    <div class="d-flex gap-2 justify-content-end">
      <button class="btn btn-sm btn-secondary" @click="emit('close')">Cancelar</button>
      <button class="btn btn-sm btn-success" @click="save" :disabled="!slugValue.trim() || !contentValue.trim() || saving || isProtected">
        {{ initialSlug ? 'Actualizar' : 'Crear plantilla' }}
      </button>
    </div>
  </div>
</template>

<script>
import { ref, onMounted } from 'vue'
import { useTemplatesStore } from '../stores/templates.js'
import { useChatStore } from '../stores/chat.js'
import ChatFormatter from './ChatFormatter.vue'

export default {
  components: { ChatFormatter },
  props: {
    initialSlug: { type: String, default: '' },
  },
  emits: ['close'],
  setup(props, { emit }) {
    const templatesStore = useTemplatesStore()
    const chatStore = useChatStore()
    const slugValue = ref(props.initialSlug)
    const contentValue = ref('')
    const tab = ref('editor')
    const saving = ref(false)
    const saveError = ref('')
    const isProtected = ref(false)

    onMounted(async () => {
      if (props.initialSlug) {
        try {
          const tmpl = await templatesStore.fetchBySlug(props.initialSlug)
          if (tmpl) {
            slugValue.value = tmpl.slug
            contentValue.value = tmpl.content
            isProtected.value = !!tmpl.is_protected
          }
        } catch (err) {
          saveError.value = err.message || 'Error al cargar plantilla'
        }
      }
    })

    async function save() {
      saving.value = true
      saveError.value = ''
      try {
        if (props.initialSlug) {
          const data = {}
          if (slugValue.value !== props.initialSlug) data.slug = slugValue.value.trim()
          data.content = contentValue.value
          await templatesStore.update(props.initialSlug, data)
          chatStore.pushMessage({
            role: 'result',
            content: `Plantilla "${slugValue.value}" actualizada.`,
            _key: 'res-' + Date.now(),
          })
        } else {
          await templatesStore.create(slugValue.value.trim(), contentValue.value)
          chatStore.pushMessage({
            role: 'result',
            content: `Plantilla "${slugValue.value}" creada.`,
            _key: 'res-' + Date.now(),
          })
        }
        emit('close')
      } catch (err) {
        saveError.value = err.message || 'Error al guardar plantilla'
      } finally {
        saving.value = false
      }
    }

    return { slugValue, contentValue, tab, saving, saveError, isProtected, save, emit }
  },
}
</script>
