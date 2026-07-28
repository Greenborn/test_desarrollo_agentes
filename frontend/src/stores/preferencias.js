import { defineStore } from 'pinia'
import api from '@/api/axios'

export const usePreferenciasStore = defineStore('preferencias', {
  state: () => ({
    definiciones: [],
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
    async fetchDefiniciones() {
      this.loading = true
      this.error = null
      try {
        const { data: body } = await api.get('/preferencias')
        if (body.status) this.definiciones = body.data
      } catch (err) {
        this.error = err.message
      } finally {
        this.loading = false
      }
    },
    async fetchMisPreferencias() {
      this.loading = true
      this.error = null
      try {
        const { data: body } = await api.get('/preferencias/usuario')
        if (body.status) {
          this.definiciones = body.data.definiciones
          this.misValores = body.data.valores
        }
      } catch (err) {
        this.error = err.response?.data?.error || err.message
      } finally {
        this.loading = false
      }
    },
    async guardarMisPreferencias(valores) {
      this.error = null
      try {
        const { data: body } = await api.put('/preferencias/usuario', valores)
        if (body.status) {
          this.misValores = { ...this.misValores, ...valores }
        }
        return body
      } catch (err) {
        this.error = err.response?.data?.error || err.message
        throw err
      }
    },
    async crearDefinicion(data) {
      const { data: body } = await api.post('/preferencias', data)
      if (body.status) await this.fetchDefiniciones()
      return body
    },
    async actualizarDefinicion(id, data) {
      const { data: body } = await api.put(`/preferencias/${id}`, data)
      if (body.status) await this.fetchDefiniciones()
      return body
    },
    async eliminarDefinicion(id) {
      const { data: body } = await api.delete(`/preferencias/${id}`)
      if (body.status) await this.fetchDefiniciones()
      return body
    },
  },
})
