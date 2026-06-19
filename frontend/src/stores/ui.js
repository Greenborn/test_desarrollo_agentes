import { defineStore } from 'pinia'
import { ref } from 'vue'

export const useUiStore = defineStore('ui', () => {
  const sidebarCollapsed = ref(false)
  const panelCollapsed = ref(false)
  const panelHeight = ref(30)
  const omnifilter = ref('')
  const sectionChats = ref(true)
  const sectionProjects = ref(true)
  const sectionTickets = ref(false)

  function toggleSidebar() {
    sidebarCollapsed.value = !sidebarCollapsed.value
    saveLayoutPrefs()
  }

  function togglePanel() {
    panelCollapsed.value = !panelCollapsed.value
    saveLayoutPrefs()
  }

  function setPanelHeight(h) {
    panelHeight.value = h
  }

  function setOmnifilter(text) {
    omnifilter.value = text
  }

  function toggleSection(name) {
    if (name === 'chats') sectionChats.value = !sectionChats.value
    else if (name === 'projects') sectionProjects.value = !sectionProjects.value
    else if (name === 'tickets') sectionTickets.value = !sectionTickets.value
    saveLayoutPrefs()
  }

  function expandAllSections() {
    sectionChats.value = true
    sectionProjects.value = true
    sectionTickets.value = true
  }

  async function saveLayoutPrefs() {
    try {
      await Promise.all([
        fetch('/api/command/setting', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          credentials: 'include',
          body: JSON.stringify({ key: 'sidebar_collapsed', value: String(sidebarCollapsed.value) }),
        }),
        fetch('/api/command/setting', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          credentials: 'include',
          body: JSON.stringify({ key: 'panel_collapsed', value: String(panelCollapsed.value) }),
        }),
        fetch('/api/command/setting', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          credentials: 'include',
          body: JSON.stringify({ key: 'panel_height', value: String(panelHeight.value) }),
        }),
        fetch('/api/command/setting', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          credentials: 'include',
          body: JSON.stringify({ key: 'section_chats', value: String(sectionChats.value) }),
        }),
        fetch('/api/command/setting', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          credentials: 'include',
          body: JSON.stringify({ key: 'section_projects', value: String(sectionProjects.value) }),
        }),
        fetch('/api/command/setting', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          credentials: 'include',
          body: JSON.stringify({ key: 'section_tickets', value: String(sectionTickets.value) }),
        }),
      ])
    } catch (err) {
      console.error('Error saving layout preferences:', err)
    }
  }

  async function loadLayoutPrefs() {
    try {
      const [sidebarRes, panelRes, heightRes, chatsRes, projectsRes, ticketsRes] = await Promise.all([
        fetch('/api/command/setting/sidebar_collapsed', { credentials: 'include' }),
        fetch('/api/command/setting/panel_collapsed', { credentials: 'include' }),
        fetch('/api/command/setting/panel_height', { credentials: 'include' }),
        fetch('/api/command/setting/section_chats', { credentials: 'include' }),
        fetch('/api/command/setting/section_projects', { credentials: 'include' }),
        fetch('/api/command/setting/section_tickets', { credentials: 'include' }),
      ])
      const sidebarData = await sidebarRes.json()
      const panelData = await panelRes.json()
      const heightData = await heightRes.json()
      const chatsData = await chatsRes.json()
      const projectsData = await projectsRes.json()
      const ticketsData = await ticketsRes.json()
      if (sidebarData.value !== null) {
        sidebarCollapsed.value = sidebarData.value === 'true'
      }
      if (panelData.value !== null) {
        panelCollapsed.value = panelData.value === 'true'
      }
      if (heightData.value !== null) {
        panelHeight.value = Math.max(5, parseInt(heightData.value, 10) || 30)
      }
      if (chatsData.value !== null) {
        sectionChats.value = chatsData.value === 'true'
      }
      if (projectsData.value !== null) {
        sectionProjects.value = projectsData.value === 'true'
      }
      if (ticketsData.value !== null) {
        sectionTickets.value = ticketsData.value === 'true'
      }
    } catch (err) {
      console.error('Error loading layout preferences:', err)
    }
  }

  return { sidebarCollapsed, panelCollapsed, panelHeight, sectionChats, sectionProjects, sectionTickets, omnifilter, toggleSidebar, togglePanel, toggleSection, expandAllSections, setPanelHeight, setOmnifilter, saveLayoutPrefs, loadLayoutPrefs }
})
