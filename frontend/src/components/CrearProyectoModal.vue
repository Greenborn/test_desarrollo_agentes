<template>
  <div>
    <div class="mb-2">
      <label class="form-label">ID del Proyecto</label>
      <input v-model="proyectoId" class="form-control form-control-sm bg-dark text-light border-secondary" placeholder="Ej: PROY-001" />
    </div>
    <div class="mb-3">
      <label class="form-label">Descripción</label>
      <input v-model="descripcion" class="form-control form-control-sm bg-dark text-light border-secondary" placeholder="Descripción del proyecto" />
    </div>
    <div class="d-flex gap-2 justify-content-end">
      <button class="btn btn-sm btn-secondary" @click="emit('close')">Cancelar</button>
      <button class="btn btn-sm btn-success" @click="crear" :disabled="!proyectoId || !descripcion">Crear y asignar</button>
    </div>
  </div>
</template>

<script>
import { ref } from 'vue'
import { useChatStore } from '../stores/chat.js'
import { useCommandStore } from '../stores/command.js'
import { useProjectStore } from '../stores/project.js'

export default {
  emits: ['close'],
  setup(props, { emit }) {
    const chatStore = useChatStore()
    const cmdStore = useCommandStore()
    const projectStore = useProjectStore()
    const proyectoId = ref('')
    const descripcion = ref('')

    async function crear() {
      if (!proyectoId.value || !descripcion.value) return
      try {
        const res = await fetch('/api/proyecto', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          credentials: 'include',
          body: JSON.stringify({ id: proyectoId.value, descripcion: descripcion.value }),
        })
        const data = await res.json()
        if (!data.success) {
          console.error('Error al crear proyecto:', data.error)
          return
        }
        const sessionId = chatStore.activeSessionId
        if (sessionId) {
          await fetch('/api/proyecto/session', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            credentials: 'include',
            body: JSON.stringify({ sessionId, proyectoId: proyectoId.value, cwd: cmdStore.currentDir || undefined }),
          })
        }
        chatStore.messages.push({
          role: 'command',
          content: `/proyecto_set ${proyectoId.value}`,
          _key: 'cmd-' + Date.now(),
        })
        chatStore.messages.push({
          role: 'result',
          content: `Proyecto "${proyectoId.value}" creado y asignado.`,
          _key: 'res-' + Date.now(),
        })
        await projectStore.loadProjects()
        emit('close')
      } catch (err) {
        console.error('Error al crear proyecto:', err)
      }
    }

    return { proyectoId, descripcion, crear, emit }
  },
}
</script>
