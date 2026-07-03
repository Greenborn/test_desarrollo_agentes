import { useCommandRegistry } from '../useCommandRegistry.js';
import { parseCommandArgs, getUsedFlags } from '../parseCommandArgs.js';
import { useModalStore } from '../../stores/modal.js';
import { useTemplatesStore } from '../../stores/templates.js';
import TemplateEditorModal from '../../components/modals/TemplateEditorModal.vue';

const { register } = useCommandRegistry();

register({
  name: '/plantilla_crear',
  category: 'Plantillas',
  description: 'Abre el editor para crear una nueva plantilla Markdown.',
  usage: '/plantilla_crear',
  async execute(args, { chatStore }) {
    const modal = useModalStore();
    modal.open(TemplateEditorModal, {}, { title: 'Nueva Plantilla' });
  },
});

register({
  name: '/plantilla_listar',
  category: 'Plantillas',
  description: 'Lista todas las plantillas disponibles.',
  usage: '/plantilla_listar',
  async execute(args, { chatStore }) {
    const templatesStore = useTemplatesStore();
    await templatesStore.fetchAll();

    if (!templatesStore.list.length) {
      return '(no hay plantillas registradas)';
    }

    const lines = templatesStore.list.map((t) => {
      const fecha = new Date(t.updated_at || t.created_at).toLocaleDateString('es-ES');
      const icon = t.is_protected ? '🔒' : '';
      return `- ${icon} **${t.slug}** (actualizado: ${fecha})`;
    });

    return lines.join('\n');
  },
});

register({
  name: '/plantilla_ver',
  category: 'Plantillas',
  description: 'Muestra el contenido de una plantilla por slug.',
  usage: '/plantilla_ver --slug=&lt;slug&gt;',
  async execute(args, { chatStore }) {
    const { params, errors } = parseCommandArgs(args, { slug: { required: true } });
    if (errors.length) return errors.join('\n');

    const templatesStore = useTemplatesStore();
    try {
      const tmpl = await templatesStore.fetchBySlug(params.slug);
      return `**Plantilla: ${tmpl.slug}**\n\n${tmpl.content}`;
    } catch (err) {
      return `Error: ${err.message}`;
    }
  },
});

register({
  name: '/plantilla_editar',
  category: 'Plantillas',
  description: 'Abre el editor para modificar una plantilla existente.',
  usage: '/plantilla_editar --slug=&lt;slug&gt;',
  async autocomplete(args, cmdStore) {
    const usedFlags = getUsedFlags(args)
    if (usedFlags.includes('--slug=')) {
      const slugArg = args.find(a => a.startsWith('--slug='));
      const val = slugArg.slice('--slug='.length);
      try {
        const res = await fetch('/api/templates', { credentials: 'include' });
        const data = await res.json();
        if (data.length) {
          const prefix = val.toLowerCase();
          const filtered = data.filter(t => t.slug.toLowerCase().includes(prefix));
          if (val && filtered.length === 1 && filtered[0].slug === val) {
            cmdStore.hideAutocomplete();
          } else {
            cmdStore.showAutocomplete(filtered.map(t => ({ display: t.slug, value: `--slug=${t.slug}` })));
          }
        }
      } catch (err) {
        console.error('Error en autocomplete de /plantilla_editar:', err);
      }
    } else {
      cmdStore.showAutocomplete(['--slug=']);
    }
  },
  async execute(args, { chatStore }) {
    const { params, errors } = parseCommandArgs(args, { slug: { required: true } });
    if (errors.length) return errors.join('\n');

    const modal = useModalStore();
    modal.open(TemplateEditorModal, { initialSlug: params.slug }, { title: `Editar Plantilla: ${params.slug}` });
  },
});

register({
  name: '/plantilla_eliminar',
  category: 'Plantillas',
  description: 'Elimina una plantilla por slug.',
  usage: '/plantilla_eliminar --slug=&lt;slug&gt;',
  async autocomplete(args, cmdStore) {
    const usedFlags = getUsedFlags(args)
    if (usedFlags.includes('--slug=')) {
      const slugArg = args.find(a => a.startsWith('--slug='));
      const val = slugArg.slice('--slug='.length);
      try {
        const res = await fetch('/api/templates', { credentials: 'include' });
        const data = await res.json();
        if (data.length) {
          const prefix = val.toLowerCase();
          const filtered = data.filter(t => t.slug.toLowerCase().includes(prefix));
          if (val && filtered.length === 1 && filtered[0].slug === val) {
            cmdStore.hideAutocomplete();
          } else {
            cmdStore.showAutocomplete(filtered.map(t => ({ display: t.slug, value: `--slug=${t.slug}` })));
          }
        }
      } catch (err) {
        console.error('Error en autocomplete de /plantilla_eliminar:', err);
      }
    } else {
      cmdStore.showAutocomplete(['--slug=']);
    }
  },
  async execute(args, { chatStore }) {
    const { params, errors } = parseCommandArgs(args, { slug: { required: true } });
    if (errors.length) return errors.join('\n');

    const templatesStore = useTemplatesStore();
    try {
      await templatesStore.remove(params.slug);
      return `Plantilla "${params.slug}" eliminada.`;
    } catch (err) {
      return `Error: ${err.message}`;
    }
  },
});
