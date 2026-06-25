import { useCommandRegistry } from '../useCommandRegistry.js';
import { useOpencodeStore } from '../../stores/opencode.js';
import { parseCommandArgs } from '../parseCommandArgs.js';

const { register } = useCommandRegistry();
const DOC_TYPES = ['base_datos', 'subproyectos', 'endpoints', 'web_sockets', 'funcionalidades', 'all'];

register({
  name: '/dev_documento_actualizar',
  category: 'Desarrollo',
  description: 'Actualiza la documentación del proyecto usando OpenCode para el tipo indicado.',
  usage: '/dev_documento_actualizar --tipo=&lt;tipo&gt;',
  async autocomplete(args, cmdStore) {
    const tipoArg = args.find(a => a.startsWith('--tipo='))
    if (tipoArg) {
      const val = tipoArg.slice('--tipo='.length)
      if (val && DOC_TYPES.includes(val)) {
        cmdStore.hideAutocomplete()
      } else {
        const filtered = DOC_TYPES.filter(t => t.startsWith(val))
        cmdStore.showAutocomplete(filtered.map(v => ({ display: v, value: `--tipo=${v}` })))
      }
    } else {
      cmdStore.showAutocomplete(['--tipo='])
    }
  },
  async execute(args, { chatStore, sessionId }) {
    if (!sessionId) {
      throw new Error('Primero debe iniciar una sesión de chat.');
    }

    const { params, errors } = parseCommandArgs(args, { tipo: { required: true } })
    if (errors.length > 0) {
      throw new Error(errors.join('. '))
    }
    const docType = params.tipo
    if (!DOC_TYPES.includes(docType)) {
      throw new Error('Tipo no válido. Use Tab para ver los tipos disponibles: ' + DOC_TYPES.join(', '))
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
      throw new Error('No hay proyecto seleccionado. Use /chat_set_proyecto primero.');
    }

    const ocStore = useOpencodeStore();
    const data = await ocStore.start();
    if (!data) {
      throw new Error('Error al iniciar OpenCode.');
    }

    const providerList = ocStore.getAvailableProviders();
    if (providerList.length === 0) {
      throw new Error('No se encontraron proveedores de OpenCode.');
    }

    const preselectProvider = ocStore.savedProvider || providerList[0].value;

    return {
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
    }
  },
});
