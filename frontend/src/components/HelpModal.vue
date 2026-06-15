<template>
  <div class="modal fade" id="helpModal" ref="modalEl" tabindex="-1">
    <div class="modal-dialog modal-lg modal-dialog-scrollable">
      <div class="modal-content bg-dark text-light">
        <div class="modal-header border-secondary">
          <h5 class="modal-title font-monospace">/help — Ayuda de comandos</h5>
          <button type="button" class="btn-close btn-close-white" data-bs-dismiss="modal"></button>
        </div>
        <div class="modal-body">
          <div v-for="(cmds, cat) in categories" :key="cat" class="mb-4">
            <h6 class="text-success text-uppercase small mb-2">{{ cat }}</h6>
            <div v-for="c in cmds" :key="c.name" class="mb-2 ps-2 border-start border-secondary">
              <code class="text-warning">{{ c.usage }}</code>
              <p class="mb-0 small text-light-emphasis">{{ c.description }}</p>
            </div>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>

<script>
import { ref, onMounted } from 'vue'
import { useCommandRegistry } from '../composables/useCommandRegistry.js'

export default {
  setup() {
    const modalEl = ref(null)
    const { categories } = useCommandRegistry()

    onMounted(() => {
      if (modalEl.value) {
        const el = modalEl.value
        el.addEventListener('hidden.bs.modal', () => {
          document.querySelectorAll('.modal-backdrop').forEach((b) => b.remove())
        })
      }
    })

    return { modalEl, categories: categories() }
  },
}
</script>
