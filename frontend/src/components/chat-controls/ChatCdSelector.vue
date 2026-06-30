<template>
  <div class="d-flex flex-column gap-2 font-monospace small" style="background: #16213e; border: 1px solid #374151; border-radius: 8px; padding: 12px;">
    <div class="d-flex align-items-center gap-2 px-2 py-1 rounded" style="background: #1a2744; border: 1px solid #2a3a5e;">
      <span style="color: #75AADB;">📁</span>
      <span style="color: #e0e0e0; word-break: break-all;">{{ currentPath }}</span>
    </div>

    <div v-if="loading" class="text-center py-2" style="color: #9ca3af;">Cargando...</div>

    <div v-else class="d-flex flex-column gap-1" style="max-height: 200px; overflow-y: auto;">
      <div
        v-if="canGoUp"
        class="d-flex align-items-center gap-2 px-2 py-1 rounded"
        style="cursor: pointer; color: #e0e0e0;"
        @click="goUp"
        @mouseenter="$event.currentTarget.style.background = '#1a2744'"
        @mouseleave="$event.currentTarget.style.background = 'transparent'"
      >
        <span style="color: #75AADB;">📁</span>
        <span>..</span>
      </div>
      <div
        v-for="dir in directories"
        :key="dir.fullPath"
        class="d-flex align-items-center gap-2 px-2 py-1 rounded"
        :style="{ cursor: 'pointer', color: '#e0e0e0', background: dir.fullPath === hoveredDir ? '#1a2744' : 'transparent' }"
        @click="navigate(dir.fullPath)"
        @mouseenter="hoveredDir = dir.fullPath"
        @mouseleave="hoveredDir = ''"
      >
        <span style="color: #75AADB;">📁</span>
        <span>{{ dir.name }}/</span>
      </div>
      <div v-if="directories.length === 0 && !canGoUp && !loading" class="text-center py-2" style="color: #9ca3af;">
        (directorio vacío)
      </div>
    </div>

    <div class="d-flex gap-2">
      <input
        v-model="manualPath"
        type="text"
        class="form-control form-control-sm bg-dark text-light border-secondary font-monospace"
        placeholder="O escribe una ruta..."
        @keydown.enter="selectPath(manualPath)"
      />
      <button class="btn btn-sm btn-outline-secondary" :disabled="!manualPath" @click="selectPath(manualPath)">
        Ir
      </button>
    </div>

    <div v-if="error" class="small px-1" style="color: #ef4444;">{{ error }}</div>

    <button class="btn btn-sm btn-success w-100" @click="selectPath(currentPath)">
      ✅ Seleccionar este directorio
    </button>
  </div>
</template>

<script>
import { ref, computed, onMounted } from 'vue'

export default {
  props: {
    currentDir: { type: String, default: '/' },
  },
  emits: ['confirm'],
  setup(props, { emit }) {
    const currentPath = ref(props.currentDir || '/')
    const directories = ref([])
    const loading = ref(false)
    const manualPath = ref('')
    const error = ref('')
    const hoveredDir = ref('')

    const canGoUp = computed(() => currentPath.value !== '/' && currentPath.value !== '')

    async function fetchDirectories() {
      loading.value = true
      error.value = ''
      try {
        const target = currentPath.value === '/' ? '/' : currentPath.value
        const res = await fetch(`/api/command/list-directories?prefix=${encodeURIComponent(target)}&cwd=${encodeURIComponent(target)}`)
        const data = await res.json()
        if (data.directories) {
          directories.value = data.directories.map(fp => ({
            fullPath: fp,
            name: fp.split('/').filter(Boolean).pop() || fp,
          }))
        } else {
          directories.value = []
        }
      } catch (err) {
        console.error('Error al cargar directorios:', err.message)
        error.value = 'Error al cargar directorios.'
        directories.value = []
      } finally {
        loading.value = false
      }
    }

    function navigate(fullPath) {
      currentPath.value = fullPath
      manualPath.value = ''
      error.value = ''
      fetchDirectories()
    }

    function goUp() {
      const parts = currentPath.value.split('/').filter(Boolean)
      parts.pop()
      currentPath.value = parts.length ? '/' + parts.join('/') : '/'
      manualPath.value = ''
      error.value = ''
      fetchDirectories()
    }

    function selectPath(path) {
      if (!path || !path.trim()) return
      emit('confirm', path.trim())
    }

    onMounted(fetchDirectories)

    return { currentPath, directories, loading, manualPath, error, canGoUp, hoveredDir, navigate, goUp, selectPath }
  },
}
</script>
