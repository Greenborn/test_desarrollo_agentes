<template>
  <div
    class="ram-indicator d-inline-flex align-items-center gap-1 flex-shrink-0"
    :title="title"
    @click="refresh"
  >
    <span class="ram-bar" :style="{ width: barWidth, background: barColor }"></span>
    <span class="ram-text">{{ percent }}%</span>
  </div>
</template>

<script>
import { computed, onBeforeUnmount, onMounted, ref } from 'vue'

const INTERVAL_MS = 5000

export default {
  setup() {
    const usedPercent = ref(null)
    const totalMem = ref(0)
    let timer = null

    const percent = computed(() => (usedPercent.value == null ? '--' : String(usedPercent.value)))
    const barWidth = computed(() => (usedPercent.value == null ? '0%' : `${usedPercent.value}%`))
    const barColor = computed(() => {
      if (usedPercent.value == null) return '#75AADB'
      if (usedPercent.value >= 90) return '#dc3545'
      if (usedPercent.value >= 70) return '#ffc107'
      return '#28a745'
    })
    const title = computed(() => {
      if (totalMem.value === 0) return 'RAM disponible: --'
      const usedGb = (usedPercent.value != null ? (totalMem.value * usedPercent.value / 100) : 0) / (1024 ** 3)
      const totalGb = totalMem.value / (1024 ** 3)
      return `RAM en uso: ${usedGb.toFixed(1)} GB / ${totalGb.toFixed(1)} GB (${percent.value}%)`
    })

    async function refresh() {
      try {
        const res = await fetch('/api/state/system', { credentials: 'include' })
        const data = await res.json()
        if (data.error) {
          console.error('RamIndicator: error al obtener métricas de RAM:', data.error)
          return
        }
        usedPercent.value = data.usedPercent
        totalMem.value = data.totalMem
      } catch (err) {
        console.error('RamIndicator: error al obtener métricas de RAM:', err)
      }
    }

    onMounted(() => {
      refresh()
      timer = setInterval(refresh, INTERVAL_MS)
    })

    onBeforeUnmount(() => {
      if (timer) clearInterval(timer)
    })

    return { percent, barWidth, barColor, title, refresh }
  },
}
</script>

<style scoped>
.ram-indicator {
  cursor: pointer;
  padding: 2px 8px;
  border-radius: 3px;
  background: rgba(117, 170, 219, 0.12);
  font-size: 0.7rem;
  color: #75AADB;
  line-height: 1;
}
.ram-bar {
  height: 8px;
  width: 40px;
  border-radius: 2px;
  background: #28a745;
  transition: background 0.3s, width 0.3s;
}
.ram-text {
  font-variant-numeric: tabular-nums;
  white-space: nowrap;
}
</style>
