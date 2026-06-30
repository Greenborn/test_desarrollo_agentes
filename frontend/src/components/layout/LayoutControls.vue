<template>
  <div class="layout-controls d-inline-flex align-items-center me-1">
    <button
      class="layout-btn"
      :class="{ active: !sidebarCollapsed }"
      @click="toggleSidebar"
      title="Toggle sidebar"
    >
      <div class="layout-icon split-h">
        <div class="part left" :class="{ filled: !sidebarCollapsed }"></div>
        <div class="part right"></div>
      </div>
    </button>
    <button
      class="layout-btn"
      :class="{ active: !panelCollapsed }"
      @click="togglePanel"
      title="Toggle panel"
    >
      <div class="layout-icon split-v">
        <div class="part top"></div>
        <div class="part bottom" :class="{ filled: !panelCollapsed }"></div>
      </div>
    </button>
    <button
      class="layout-btn"
      :class="{ active: !rightPanelCollapsed }"
      @click="toggleRightPanel"
      title="Toggle right panel"
    >
      <div class="layout-icon split-h mirror-h">
        <div class="part left"></div>
        <div class="part right" :class="{ filled: !rightPanelCollapsed }"></div>
      </div>
    </button>
    <button
      class="layout-btn"
      :class="{ active: !centralPanelCollapsed }"
      @click="toggleCentralPanel"
      title="Toggle central panel"
    >
      <div class="layout-icon window">
        <div class="part content" :class="{ filled: !centralPanelCollapsed }"></div>
      </div>
    </button>
  </div>
</template>

<script>
import { onMounted } from 'vue'
import { storeToRefs } from 'pinia'
import { useUiStore } from '../../stores/ui.js'

export default {
  setup() {
    const ui = useUiStore()
    const { sidebarCollapsed, panelCollapsed, rightPanelCollapsed, centralPanelCollapsed } = storeToRefs(ui)

    onMounted(() => {
      ui.loadLayoutPrefs()
    })

    return {
      sidebarCollapsed,
      panelCollapsed,
      rightPanelCollapsed,
      centralPanelCollapsed,
      toggleSidebar: ui.toggleSidebar,
      togglePanel: ui.togglePanel,
      toggleRightPanel: ui.toggleRightPanel,
      toggleCentralPanel: ui.toggleCentralPanel,
    }
  },
}
</script>

<style scoped>
.layout-btn {
  background: none;
  border: none;
  color: #75AADB;
  cursor: pointer;
  padding: 3px;
  border-radius: 3px;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  opacity: 0.6;
  transition: opacity 0.15s;
}
.layout-btn:hover {
  opacity: 1;
  background: rgba(117, 170, 219, 0.1);
}
.layout-btn.active {
  opacity: 1;
}
.layout-icon {
  width: 18px;
  height: 14px;
  border: 1.5px solid currentColor;
  border-radius: 2px;
  display: flex;
  box-sizing: border-box;
}
.layout-icon.split-h {
  flex-direction: row;
}
.layout-icon.split-v {
  flex-direction: column;
}
.layout-icon .part {
  box-sizing: border-box;
}
.layout-icon.split-h .part.left {
  width: 40%;
  border-right: 1.5px solid currentColor;
}
.layout-icon.split-h .part.right {
  flex: 1;
}
.layout-icon.split-h .part.left.filled {
  background: currentColor;
}
.layout-icon.split-h.mirror-h .part.left {
  width: auto;
  flex: 1;
  border-right: none;
}
.layout-icon.split-h.mirror-h .part.right {
  width: 40%;
  flex: none;
  border-left: 1.5px solid currentColor;
}
.layout-icon.split-v .part.top {
  flex: 1;
}
.layout-icon.split-v .part.bottom {
  height: 40%;
  border-top: 1.5px solid currentColor;
}
.layout-icon.split-v .part.bottom.filled {
  background: currentColor;
}
.layout-icon.window {
  display: flex;
  align-items: center;
  justify-content: center;
}
.layout-icon.window .part.content {
  width: 70%;
  height: 70%;
  border: 1.5px solid currentColor;
  border-radius: 1px;
  background: transparent;
  transition: background 0.15s;
}
.layout-icon.window .part.content.filled {
  background: currentColor;
}
</style>
