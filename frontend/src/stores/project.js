import { defineStore } from 'pinia'
import { ref } from 'vue'

const API = '/api'

export const useProjectStore = defineStore('project', () => {
  const projects = ref([])
  const selectedProject = ref(null)
  const pinnedProjectId = ref(null)

  async function loadProjects() {
    try {
      const res = await fetch(`${API}/proyecto`, { credentials: 'include' })
      const data = await res.json()
      projects.value = data.proyectos || []
      pinnedProjectId.value = data.pinnedProjectId || null
      if (selectedProject.value) {
        const updated = projects.value.find(p => p.id === selectedProject.value.id)
        if (updated) selectedProject.value = updated
      }
    } catch (err) {
      console.error('Error al cargar proyectos:', err)
    }
  }

  async function togglePin(proyectoId) {
    const isPinned = pinnedProjectId.value === proyectoId
    const newVal = isPinned ? null : proyectoId
    try {
      const res = await fetch(`${API}/proyecto/pin`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ proyectoId: newVal }),
      })
      if (!res.ok) throw new Error('Error al guardar')
      pinnedProjectId.value = newVal
      projects.value = reorderProjects(projects.value, newVal)
    } catch (err) {
      console.error('Error al cambiar pin:', err)
    }
  }

  function selectProject(project) {
    selectedProject.value = project
  }

  function clearSelection() {
    selectedProject.value = null
  }

  function reorderProjects(list, pinnedId) {
    if (!pinnedId) return list
    const idx = list.findIndex(p => p.id === pinnedId)
    if (idx > 0) {
      const copy = [...list]
      const [pinned] = copy.splice(idx, 1)
      copy.unshift(pinned)
      return copy
    }
    return list
  }

  return { projects, selectedProject, pinnedProjectId, loadProjects, togglePin, selectProject, clearSelection }
})
