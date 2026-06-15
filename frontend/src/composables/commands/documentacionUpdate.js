import { useCommandRegistry } from '../useCommandRegistry.js';
import { useOpencodeStore } from '../../stores/opencode.js';

const { register } = useCommandRegistry();
const DOC_TYPES = ['base_de_datos', 'subproyectos', 'endpoints', 'web_sockets', 'funcionalidades'];

register({
  name: '/documentacion_update',
  category: 'Desarrollo',
  description: 'Actualiza la documentación del proyecto usando OpenCode para el tipo indicado.',
  usage: '/documentacion_update <tipo>',
  async autocomplete(args, cmdStore) {
    const current = args[0] || '';
    const filtered = DOC_TYPES.filter((t) => t.startsWith(current));
    cmdStore.showAutocomplete(filtered);
  },
  async execute(args, { chatStore }) {
    const sessionId = chatStore.activeSessionId;
    if (!sessionId) {
      chatStore.messages.push({
        role: 'result',
        content: 'Primero debe iniciar una sesión de chat.',
        _key: 'result-' + Date.now(),
      });
      return;
    }

    const docType = args[0];
    if (!docType || !DOC_TYPES.includes(docType)) {
      chatStore.messages.push({
        role: 'result',
        content: 'Debe especificar un tipo: ' + DOC_TYPES.join(', '),
        _key: 'result-' + Date.now(),
      });
      return;
    }

    let proyectoId;
    try {
      const res = await fetch(`/api/proyecto/session/${sessionId}`, { credentials: 'include' });
      const data = await res.json();
      proyectoId = data.proyectoId;
    } catch (err) {
      console.error('Error al obtener proyecto de sesión:', err.message);
    }

    if (!proyectoId) {
      chatStore.messages.push({
        role: 'result',
        content: 'No hay proyecto seleccionado. Use /proyecto_set primero.',
        _key: 'result-' + Date.now(),
      });
      return;
    }

    const ocStore = useOpencodeStore();
    const data = await ocStore.start();
    if (!data) {
      chatStore.messages.push({
        role: 'result',
        content: 'Error al iniciar OpenCode.',
        _key: 'result-' + Date.now(),
      });
      return;
    }

    const providerList = ocStore.getAvailableProviders();
    if (providerList.length === 0) {
      chatStore.messages.push({
        role: 'result',
        content: 'No se encontraron proveedores de OpenCode.',
        _key: 'result-' + Date.now(),
      });
      return;
    }

    const preselectProvider = ocStore.savedProvider || providerList[0].value;

    chatStore.messages.push({
      role: 'opencode_control',
      controlData: {
        controlId: 'provider-' + Date.now(),
        controlType: 'select',
        stepType: 'documentacion_update',
        subStepType: 'provider',
        options: providerList,
        placeholder: 'Selecciona proveedor...',
        preselect: preselectProvider,
        proyectoId,
        docType,
      },
      _key: 'control-' + Date.now(),
    });
  },
});
