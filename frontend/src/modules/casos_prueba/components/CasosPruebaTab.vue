<template>
  <div class="casos-prueba-container d-flex flex-grow-1 overflow-hidden" style="min-height: 0;">
    <div class="casos-prueba-list flex-shrink-0 overflow-hidden" :style="{ width: effectiveCasosPruebaListWidth + 'px' }">
      <div class="d-flex align-items-center justify-content-center h-100 text-secondary small px-3 text-center">
        <span>En construcción</span>
      </div>
    </div>
    <div class="casos-prueba-splitter" @mousedown.prevent="onCasosPruebaSplitStart"></div>
    <div class="casos-prueba-middle flex-shrink-0 overflow-hidden" :style="{ width: effectiveCasosPruebaMiddleWidth + 'px' }">
      <div class="d-flex align-items-center justify-content-center h-100 text-secondary small px-3 text-center">
        <span>En construcción</span>
      </div>
    </div>
    <div class="casos-prueba-splitter-middle" @mousedown.prevent="onCasosPruebaMiddleSplitStart"></div>
    <div class="casos-prueba-detail flex-grow-1 d-flex align-items-center justify-content-center text-secondary small px-3 text-center">
      <span>En construcción</span>
    </div>
  </div>
</template>

<script>
import { ref, computed, onMounted } from 'vue'
import { storeToRefs } from 'pinia'
import { useUiStore } from '../../../stores/ui.js'
import { settingSet, settingGet } from '../../../services/settingService.js'

export default {
  setup() {
    const ui = useUiStore()
    const { centralPanelCollapsed, sidebarCollapsed } = storeToRefs(ui)

    const isFullWidth = computed(() => centralPanelCollapsed.value && sidebarCollapsed.value)

    const casosPruebaListWidth = ref(180)
    const casosPruebaListWidthFull = ref(300)
    const CASOS_PRUEBA_LIST_WIDTH_KEY = 'casos_prueba_list_width'
    const CASOS_PRUEBA_LIST_WIDTH_FULL_KEY = 'casos_prueba_list_width_full'
    const CASOS_PRUEBA_LIST_MIN = 80

    const effectiveCasosPruebaListWidth = computed(() => isFullWidth.value ? casosPruebaListWidthFull.value : casosPruebaListWidth.value)

    async function loadCasosPruebaListWidth() {
      try {
        const [normal, full] = await Promise.all([
          settingGet(CASOS_PRUEBA_LIST_WIDTH_KEY),
          settingGet(CASOS_PRUEBA_LIST_WIDTH_FULL_KEY),
        ])
        if (normal.value) {
          casosPruebaListWidth.value = Math.max(CASOS_PRUEBA_LIST_MIN, parseInt(normal.value, 10) || 180)
        }
        if (full.value) {
          casosPruebaListWidthFull.value = Math.max(CASOS_PRUEBA_LIST_MIN, parseInt(full.value, 10) || 300)
        }
      } catch (err) {
        console.error('Error al cargar ancho de lista de casos de prueba:', err)
      }
    }

    async function saveCasosPruebaListWidth() {
      try {
        await Promise.all([
          settingSet(CASOS_PRUEBA_LIST_WIDTH_KEY, String(casosPruebaListWidth.value)),
          settingSet(CASOS_PRUEBA_LIST_WIDTH_FULL_KEY, String(casosPruebaListWidthFull.value)),
        ])
      } catch (err) {
        console.error('Error al guardar ancho de lista de casos de prueba:', err)
      }
    }

    const casosPruebaMiddleWidth = ref(180)
    const casosPruebaMiddleWidthFull = ref(300)
    const CASOS_PRUEBA_MIDDLE_WIDTH_KEY = 'casos_prueba_middle_width'
    const CASOS_PRUEBA_MIDDLE_WIDTH_FULL_KEY = 'casos_prueba_middle_width_full'
    const CASOS_PRUEBA_MIDDLE_MIN = 80

    const effectiveCasosPruebaMiddleWidth = computed(() => isFullWidth.value ? casosPruebaMiddleWidthFull.value : casosPruebaMiddleWidth.value)

    async function loadCasosPruebaMiddleWidth() {
      try {
        const [normal, full] = await Promise.all([
          settingGet(CASOS_PRUEBA_MIDDLE_WIDTH_KEY),
          settingGet(CASOS_PRUEBA_MIDDLE_WIDTH_FULL_KEY),
        ])
        if (normal.value) {
          casosPruebaMiddleWidth.value = Math.max(CASOS_PRUEBA_MIDDLE_MIN, parseInt(normal.value, 10) || 180)
        }
        if (full.value) {
          casosPruebaMiddleWidthFull.value = Math.max(CASOS_PRUEBA_MIDDLE_MIN, parseInt(full.value, 10) || 300)
        }
      } catch (err) {
        console.error('Error al cargar ancho de columna media de casos de prueba:', err)
      }
    }

    async function saveCasosPruebaMiddleWidth() {
      try {
        await Promise.all([
          settingSet(CASOS_PRUEBA_MIDDLE_WIDTH_KEY, String(casosPruebaMiddleWidth.value)),
          settingSet(CASOS_PRUEBA_MIDDLE_WIDTH_FULL_KEY, String(casosPruebaMiddleWidthFull.value)),
        ])
      } catch (err) {
        console.error('Error al guardar ancho de columna media de casos de prueba:', err)
      }
    }

    function onCasosPruebaSplitStart(e) {
      const startX = e.clientX
      const startWidth = casosPruebaListWidth.value
      const startWidthFull = casosPruebaListWidthFull.value
      const container = e.target.closest('.casos-prueba-container')

      function onMouseMove(e) {
        const delta = e.clientX - startX
        const containerWidth = container ? container.getBoundingClientRect().width : 400
        const minWidth = 80
        const maxWidth = containerWidth - 80
        if (isFullWidth.value) {
          casosPruebaListWidthFull.value = Math.max(minWidth, Math.min(maxWidth, startWidthFull + delta))
        } else {
          casosPruebaListWidth.value = Math.max(minWidth, Math.min(maxWidth, startWidth + delta))
        }
      }

      function onMouseUp() {
        document.removeEventListener('mousemove', onMouseMove)
        document.removeEventListener('mouseup', onMouseUp)
        document.body.style.cursor = ''
        document.body.style.userSelect = ''
        saveCasosPruebaListWidth()
      }

      document.addEventListener('mousemove', onMouseMove)
      document.addEventListener('mouseup', onMouseUp)
      document.body.style.cursor = 'col-resize'
      document.body.style.userSelect = 'none'
    }

    function onCasosPruebaMiddleSplitStart(e) {
      const startX = e.clientX
      const startWidth = casosPruebaMiddleWidth.value
      const startWidthFull = casosPruebaMiddleWidthFull.value
      const container = e.target.closest('.casos-prueba-container')

      function onMouseMove(e) {
        const delta = e.clientX - startX
        const containerWidth = container ? container.getBoundingClientRect().width : 400
        const minWidth = 80
        const maxWidth = containerWidth - 80
        if (isFullWidth.value) {
          casosPruebaMiddleWidthFull.value = Math.max(minWidth, Math.min(maxWidth, startWidthFull + delta))
        } else {
          casosPruebaMiddleWidth.value = Math.max(minWidth, Math.min(maxWidth, startWidth + delta))
        }
      }

      function onMouseUp() {
        document.removeEventListener('mousemove', onMouseMove)
        document.removeEventListener('mouseup', onMouseUp)
        document.body.style.cursor = ''
        document.body.style.userSelect = ''
        saveCasosPruebaMiddleWidth()
      }

      document.addEventListener('mousemove', onMouseMove)
      document.addEventListener('mouseup', onMouseUp)
      document.body.style.cursor = 'col-resize'
      document.body.style.userSelect = 'none'
    }

    onMounted(() => {
      loadCasosPruebaListWidth()
      loadCasosPruebaMiddleWidth()
    })

    return {
      effectiveCasosPruebaListWidth,
      onCasosPruebaSplitStart,
      effectiveCasosPruebaMiddleWidth,
      onCasosPruebaMiddleSplitStart,
    }
  },
}
</script>

<style scoped>
.casos-prueba-container {
  background: #16213e;
}
.casos-prueba-list {
  background: #16213e;
}
.casos-prueba-splitter {
  width: 6px;
  cursor: col-resize;
  flex-shrink: 0;
  background: transparent;
  transition: background 0.15s;
  position: relative;
  z-index: 5;
}
.casos-prueba-splitter:hover {
  background: rgba(117, 170, 219, 0.12);
}
.casos-prueba-middle {
  background: #16213e;
}
.casos-prueba-splitter-middle {
  width: 6px;
  cursor: col-resize;
  flex-shrink: 0;
  background: transparent;
  transition: background 0.15s;
  position: relative;
  z-index: 5;
}
.casos-prueba-splitter-middle:hover {
  background: rgba(117, 170, 219, 0.12);
}
.casos-prueba-detail {
  background: #0f172a;
}
</style>
