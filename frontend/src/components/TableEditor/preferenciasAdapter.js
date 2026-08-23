import { usePreferenciasStore } from '@/stores/preferencias'

export function createPiniaPrefsAdapter() {
  const store = usePreferenciasStore()
  return {
    get misValores() {
      return store.misValores
    },
    valor(key) {
      return store.valor(key)
    },
    async guardarValores(data) {
      return store.guardarMisPreferencias(data)
    },
    async fetchMisPreferencias() {
      return store.fetchMisPreferencias()
    },
  }
}
