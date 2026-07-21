<template>
  <div class="deploy-config-form">
    <div class="mb-2 fw-semibold" style="color: #e0e0e0; font-size: 0.9rem;">
      No se encontró <code>deploy.json</code> en el directorio del proyecto.
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
        El <code>deploy.json</code> se creará en este directorio. Se puede predefinir con <code>--dir=&lt;ruta&gt;</code>.
      </div>
    </div>
    <div class="mb-2" style="color: #9ca3af; font-size: 0.8rem;">
      Define los subproyectos que forman parte del despliegue:
    </div>

    <div
      v-for="(sp, i) in subprojects"
      :key="i"
      class="d-flex align-items-center gap-2 mb-2"
    >
      <input
        v-model="sp.cwd"
        type="text"
        class="form-control form-control-sm"
        style="max-width: 220px; background: #0d1b2a; border: 1px solid #374151; color: #e0e0e0;"
        placeholder="Nombre/cwd (ej: backend)"
      />
      <select
        v-model="sp.type"
        class="form-select form-select-sm"
        style="max-width: 180px; background: #0d1b2a; border: 1px solid #374151; color: #e0e0e0;"
      >
        <option value="backend">Backend (nodemon)</option>
        <option value="frontend">Frontend (npm run dev)</option>
      </select>
      <button
        class="btn btn-sm"
        style="background: transparent; border: 1px solid #ef4444; color: #ef4444; line-height: 1;"
        @click="remove(i)"
        title="Eliminar subproyecto"
      >
        ✕
      </button>
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
    const subprojects = ref(
      props.initialSubprojects && props.initialSubprojects.length > 0
        ? props.initialSubprojects.map(s => ({ cwd: s.cwd || '', type: s.type || 'backend' }))
        : [{ cwd: '', type: 'backend' }]
    )
    const rootDir = ref(props.projectDir || '')
    const error = ref('')

    function add() {
      error.value = ''
      subprojects.value.push({ cwd: '', type: 'backend' })
    }

    function remove(i) {
      if (subprojects.value.length <= 1) return
      error.value = ''
      subprojects.value.splice(i, 1)
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
        subprojects: subprojects.value.map(sp => ({ cwd: sp.cwd.trim(), type: sp.type })),
      }
      if (rootDir.value.trim()) {
        result.dir = rootDir.value.trim()
      }
      emit('confirm', result)
    }

    function cancel() {
      emit('confirm', null)
    }

    return { subprojects, rootDir, error, add, remove, confirm, cancel }
  },
}
</script>
