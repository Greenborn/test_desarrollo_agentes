<template>
  <div class="deploy-config-form">
    <div class="mb-2 fw-semibold" style="color: #e0e0e0; font-size: 0.9rem;">
      Configuración de despliegue
    </div>
    <div class="mb-3" style="color: #9ca3af; font-size: 0.8rem;">
      <div class="mb-1">Directorio raíz del proyecto:</div>
      <input
        v-model="rootDir"
        type="text"
        class="form-control form-control-sm"
        style="background: #0d1b2a; border: 1px solid #374151; color: #e0e0e0; font-family: monospace;"
        placeholder="/ruta/al/proyecto"
      />
      <div class="mt-1" style="color: #6b7280; font-size: 0.75rem;">
        El <code>deploy.json</code> se creará en este directorio.
      </div>
    </div>
    <div class="mb-2" style="color: #9ca3af; font-size: 0.8rem;">
      Define los subproyectos que forman parte del despliegue:
    </div>

    <div
      v-for="(sp, i) in subprojects"
      :key="i"
      class="d-flex flex-column gap-1 mb-2 p-2"
      style="border: 1px solid #374151; border-radius: 6px; background: rgba(13, 27, 42, 0.4);"
    >
      <div class="d-flex align-items-center gap-2">
        <input
          v-model="sp.cwd"
          type="text"
          class="form-control form-control-sm"
          style="max-width: 200px; background: #0d1b2a; border: 1px solid #374151; color: #e0e0e0;"
          placeholder="Nombre/cwd (ej: backend)"
        />
        <select
          v-model="sp.type"
          class="form-select form-select-sm"
          style="max-width: 160px; background: #0d1b2a; border: 1px solid #374151; color: #e0e0e0;"
        >
          <option value="backend">Backend (nodemon)</option>
          <option value="frontend">Frontend (npm run dev)</option>
        </select>
        <button
          class="btn btn-sm"
          style="background: transparent; border: 1px solid #75AADB; color: #75AADB; line-height: 1;"
          @click="toggleCustom(i)"
          :title="sp.command ? 'Comando personalizado activo' : 'Añadir comando personalizado'"
        >
          ⚙️
        </button>
        <button
          class="btn btn-sm"
          style="background: transparent; border: 1px solid #ef4444; color: #ef4444; line-height: 1;"
          @click="remove(i)"
          title="Eliminar subproyecto"
        >
          ✕
        </button>
      </div>
      <div v-if="sp.showCustom" class="d-flex align-items-center gap-2 ms-1">
        <input
          v-model="sp.command"
          type="text"
          class="form-control form-control-sm"
          style="max-width: 370px; background: #0d1b2a; border: 1px solid #eab308; color: #eab308; font-family: monospace; font-size: 0.8rem;"
          placeholder="Ej: npm run dev:custom"
        />
        <span style="color: #6b7280; font-size: 0.7rem;">(vacío = usa el comando por defecto según tipo)</span>
      </div>
    </div>

    <button
      class="btn btn-sm mb-3"
      style="background: transparent; border: 1px dashed #75AADB; color: #75AADB;"
      @click="add()"
    >
      + Añadir subproyecto
    </button>

    <div v-if="error" class="mb-2" style="color: #ef4444; font-size: 0.8rem;">
      {{ error }}
    </div>

    <div class="d-flex gap-2">
      <button
        class="btn btn-sm"
        style="background: #75AADB; border: none; color: #fff;"
        @click="confirm()"
      >
        ✓ Confirmar
      </button>
      <button
        class="btn btn-sm"
        style="background: transparent; border: 1px solid #6b7280; color: #9ca3af;"
        @click="cancel()"
      >
        ✗ Cancelar
      </button>
    </div>
  </div>
</template>

<script>
import { ref } from 'vue'

export default {
  props: {
    initialSubprojects: { type: Array, default: () => [] },
    projectDir: { type: String, default: '' },
  },
  emits: ['confirm'],
  setup(props, { emit }) {
    function mapInitial(sp) {
      return { cwd: sp.cwd || '', type: sp.type || 'backend', command: sp.command || '', showCustom: !!sp.command }
    }
    const subprojects = ref(
      props.initialSubprojects && props.initialSubprojects.length > 0
        ? props.initialSubprojects.map(mapInitial)
        : [{ cwd: '', type: 'backend', command: '', showCustom: false }]
    )
    const rootDir = ref(props.projectDir || '')
    const error = ref('')

    function add() {
      error.value = ''
      subprojects.value.push({ cwd: '', type: 'backend', command: '', showCustom: false })
    }

    function remove(i) {
      if (subprojects.value.length <= 1) return
      error.value = ''
      subprojects.value.splice(i, 1)
    }

    function toggleCustom(i) {
      const sp = subprojects.value[i]
      sp.showCustom = !sp.showCustom
      if (!sp.showCustom) {
        sp.command = ''
      }
    }

    function validate() {
      for (let i = 0; i < subprojects.value.length; i++) {
        if (!subprojects.value[i].cwd.trim()) {
          return `El subproyecto #${i + 1} debe tener un nombre.`
        }
      }
      return null
    }

    function confirm() {
      error.value = ''
      const err = validate()
      if (err) {
        error.value = err
        return
      }
      const result = {
        subprojects: subprojects.value.map(sp => {
          const entry = { cwd: sp.cwd.trim(), type: sp.type }
          if (sp.command && sp.command.trim()) {
            entry.command = sp.command.trim()
          }
          return entry
        }),
      }
      if (rootDir.value.trim()) {
        result.dir = rootDir.value.trim()
      }
      emit('confirm', result)
    }

    function cancel() {
      emit('confirm', null)
    }

    return { subprojects, rootDir, error, add, remove, toggleCustom, confirm, cancel }
  },
}
</script>
