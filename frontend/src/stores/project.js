import { defineStore } from 'pinia'
import { ref } from 'vue'

const API = '/api'

export const useProjectStore = defineStore('project', () => {
  const projects = ref([])
  const selectedProject = ref(null)

  async function loadProjects() {
    try {
      const res = await fetch(`${API}/proyecto`, { credentials: 'include' })
      const data = await res.json()
      projects.value = data.proyectos || []
    } catch (err) {
      console.error('Error al cargar proyectos:', err)
    }
  }

  function selectProject(project) {
    selectedProject.value = project
  }

  function clearSelection() {
    selectedProject.value = null
  }

  return { projects, selectedProject, loadProjects, selectProject, clearSelection }
})
