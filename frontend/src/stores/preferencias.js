import { defineStore } from 'pinia'
import { settingGet, settingSet } from '@/services/settingService.js'

const PREFS_KEY = 'table_editor_prefs'

function parsePrefs(raw) {
  if (!raw) return {}
  try {
    const parsed = JSON.parse(raw)
    return parsed && typeof parsed === 'object' ? parsed : {}
  } catch (err) {
    console.log('preferencias: error al parsear preferencias guardadas, se ignoran:', err.message)
    return {}
  }
}

export const usePreferenciasStore = defineStore('preferencias', {
  state: () => ({
    misValores: {},
    loading: false,
    error: null,
  }),
  getters: {
    valor(state) {
      return (clave) => state.misValores[clave] || null
    },
  },
  actions: {
    async fetchMisPreferencias() {
      this.loading = true
      this.error = null
      try {
        const result = await settingGet(PREFS_KEY)
        this.misValores = parsePrefs(result.value)
      } catch (err) {
        console.log('preferencias: error al cargar preferencias:', err.message)
        this.error = err.message
      } finally {
        this.loading = false
      }
    },
    async guardarMisPreferencias(valores) {
      this.error = null
      this.misValores = { ...this.misValores, ...valores }
      try {
        await settingSet(PREFS_KEY, JSON.stringify(this.misValores))
        return { status: true }
      } catch (err) {
        console.log('preferencias: error al guardar preferencias:', err.message)
        this.error = err.message
        throw err
      }
    },
  },
})
