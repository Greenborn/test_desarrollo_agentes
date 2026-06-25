<template>
  <div class="d-flex flex-column h-100">
    <ul class="nav nav-tabs border-secondary mb-3 flex-shrink-0">
      <li class="nav-item" v-for="tab in tabs" :key="tab.key">
        <button
          class="nav-link"
          :class="{ active: activeTab === tab.key, 'text-light': activeTab === tab.key, 'text-secondary': activeTab !== tab.key }"
          :style="activeTab === tab.key ? { background: '#2c3034', borderColor: '#495057' } : {}"
          @click="activeTab = tab.key"
        >
          {{ tab.label }}
        </button>
      </li>
    </ul>

    <div class="flex-fill d-flex flex-column" style="min-height: 0;">
      <template v-if="activeTab === 'relevamiento'">
        <div class="mb-2 flex-shrink-0">
          <label class="form-label small text-light-emphasis mb-1">Nombre de la funcionalidad</label>
          <input v-model="nombre" class="form-control form-control-sm bg-dark text-light border-secondary font-monospace" placeholder="Ej: Login con Google" />
        </div>
        <div class="mb-2 flex-shrink-0">
          <label class="form-label small text-light-emphasis mb-1">URL Redmine (opcional)</label>
          <input v-model="urlRedmine" class="form-control form-control-sm bg-dark text-light border-secondary font-monospace" placeholder="https://redmine..." />
        </div>
      </template>
      <div class="d-flex flex-column flex-fill" style="min-height: 0;">
        <label class="form-label small text-light-emphasis mb-1 flex-shrink-0">{{ activeTabData.label }}</label>
        <textarea
          class="form-control font-monospace small flex-fill"
          :value="formData[activeTab]"
          @input="formData[activeTab] = $event.target.value"
          :style="{ background: '#1a2744', color: '#e0e0e0', border: '1px solid #495057', resize: 'none', minHeight: '120px' }"
          :placeholder="activeTabData.placeholder"
        ></textarea>
      </div>
    </div>

    <div class="d-flex justify-content-end gap-2 mt-3 flex-shrink-0">
      <button class="btn btn-outline-secondary btn-sm" @click="$emit('close')">Cancelar</button>
      <button class="btn btn-success btn-sm" @click="save" :disabled="saving">
        {{ saving ? 'Guardando...' : 'Guardar' }}
      </button>
    </div>
  </div>
</template>

<script>
import { computed, onMounted } from 'vue';
import { useFuncionalidadStore } from '../stores/funcionalidad.js';

export default {
  props: {
    sessionId: { type: Number, required: true },
    proyectoId: { type: String, default: null },
  },
  emits: ['close'],
  setup(props, { emit }) {
    const tabs = [
      { key: 'relevamiento', label: 'Relevamiento Funcionalidad', placeholder: 'Describa los requisitos y alcance de la funcionalidad...' },
      { key: 'diseno', label: 'Diseño', placeholder: 'Describa el diseño de la solución, componentes, flujos...' },
      { key: 'implementacion', label: 'Implementación', placeholder: 'Detalles de implementación, archivos a modificar, lógica...' },
      { key: 'testing', label: 'Testing', placeholder: 'Casos de prueba, escenarios, criterios de aceptación...' },
      { key: 'documentacion', label: 'Documentación', placeholder: 'Documentación necesaria, manuales, comentarios...' },
    ];

    const funcStore = useFuncionalidadStore();

    const activeTabData = computed(() => tabs.find(t => t.key === funcStore.activeTab));

    async function handleSave() {
      const data = await funcStore.save({ sessionId: props.sessionId, proyectoId: props.proyectoId });
      if (data.success) {
        emit('close');
      }
    }

    onMounted(() => funcStore.load(props.sessionId));

    return { tabs, activeTab: funcStore.activeTab, activeTabData, formData: funcStore.formData, nombre: funcStore.nombre, urlRedmine: funcStore.urlRedmine, saving: funcStore.saving, save: handleSave };
  },
};
</script>
