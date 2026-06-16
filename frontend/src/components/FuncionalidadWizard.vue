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
          :style="{ background: '#1a1a2e', color: '#e0e0e0', border: '1px solid #495057', resize: 'none', minHeight: '120px' }"
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
import { ref, reactive, computed, onMounted } from 'vue';

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

    const activeTab = ref('relevamiento');
    const activeTabData = computed(() => tabs.find(t => t.key === activeTab.value));
    const saving = ref(false);
    const nombre = ref('');
    const urlRedmine = ref('');
    const formData = reactive({
      relevamiento: '',
      diseno: '',
      implementacion: '',
      testing: '',
      documentacion: '',
    });

    async function load() {
      try {
        const res = await fetch(`/api/funcionalidad/${props.sessionId}`, { credentials: 'include' });
        const data = await res.json();
        if (data.funcionalidad) {
          nombre.value = data.funcionalidad.nombre || '';
          urlRedmine.value = data.funcionalidad.url_redmine || '';
          if (data.funcionalidad.parametros) {
            const p = data.funcionalidad.parametros;
            if (p.relevamiento) formData.relevamiento = p.relevamiento;
            if (p.diseno) formData.diseno = p.diseno;
            if (p.implementacion) formData.implementacion = p.implementacion;
            if (p.testing) formData.testing = p.testing;
            if (p.documentacion) formData.documentacion = p.documentacion;
            if (data.funcionalidad.etapa) activeTab.value = data.funcionalidad.etapa.toLowerCase();
          }
        }
      } catch (err) {
        console.error('Error al cargar funcionalidad:', err.message);
      }
    }

    async function save() {
      saving.value = true;
      try {
        const res = await fetch('/api/funcionalidad', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          credentials: 'include',
          body: JSON.stringify({
            sessionId: props.sessionId,
            proyectoId: props.proyectoId,
            etapa: activeTab.value.toUpperCase(),
            parametros: { ...formData },
            nombre: nombre.value,
            url_redmine: urlRedmine.value || null,
          }),
        });
        const data = await res.json();
        if (data.success) {
          emit('close');
        } else {
          console.error('Error al guardar:', data.error);
        }
      } catch (err) {
        console.error('Error al guardar funcionalidad:', err.message);
      } finally {
        saving.value = false;
      }
    }

    onMounted(load);

    return { tabs, activeTab, activeTabData, formData, nombre, urlRedmine, saving, save };
  },
};
</script>
