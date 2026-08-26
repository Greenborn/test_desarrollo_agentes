<template>
  <div class="d-flex flex-column gap-2">
    <CrearProyectoRedmineControl
      :prefill="{ workspaceId: workspaceId }"
      ocultarAsignarSesion
      @confirm="onConfirm"
    />
  </div>
</template>

<script>
import { ref } from 'vue'
import { useModal } from 'vue-greenborn-modal-manager'
import CrearProyectoRedmineControl from '../projects/CrearProyectoRedmineControl.vue'

export default {
  props: {
    parametros: {
      type: Object,
      default: () => ({}),
    },
  },
  components: { CrearProyectoRedmineControl },
  setup(props) {
    const { ocultar_modal, mostrar_alerta } = useModal()
    const workspaceId = ref(props.parametros.workspaceId || '')

    async function onConfirm(payload) {
      if (payload === null) {
        ocultar_modal(props.parametros._modal_cod)
        return
      }
      try {
        const res = await fetch('/api/proyecto/crear-en-redmine', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          credentials: 'include',
          body: JSON.stringify({ ...payload, asignar_a_sesion: false }),
        })
        const data = await res.json()
        if (data.success) {
          if (typeof props.parametros.onCreated === 'function') {
            props.parametros.onCreated(data.proyecto)
          }
          ocultar_modal(props.parametros._modal_cod)
        } else {
          mostrar_alerta(data.error || 'Error al crear el proyecto')
        }
      } catch (err) {
        console.log('Error al crear proyecto en Redmine:', err)
        mostrar_alerta('Error al crear el proyecto: ' + err.message)
      }
    }

    return { workspaceId, onConfirm }
  },
}
</script>
