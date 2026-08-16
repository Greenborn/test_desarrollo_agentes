import { defineAsyncComponent } from 'vue'
import TabLoading from '../components/layout/TabLoading.vue'

// Wrapper sobre defineAsyncComponent para las tabs de los paneles laterales.
// Añade un componente de carga (feedback visual) y un timeout de error para que,
// mientras el chunk del módulo se descarga/parsea/evalúa en el main thread,
// la UI no quede sin indicación. delay = 0 para que el spinner aparezca
// inmediatamente en el primer clic.
export function defineAsyncTab(loader) {
  return defineAsyncComponent({
    loader,
    loadingComponent: TabLoading,
    delay: 0,
    timeout: 15000,
  })
}
