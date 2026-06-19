<template>
  <svg
    v-if="commits.length > 0"
    :viewBox="viewBoxValue"
    class="git-graph-svg d-block"
    xmlns="http://www.w3.org/2000/svg"
  >
    <line
      v-for="lane in laneLines"
      :key="'ll-' + lane.idx"
      :x1="laneCenter(lane.idx)"
      y1="0"
      :x2="laneCenter(lane.idx)"
      :y2="svgHeight"
      :stroke="lane.color"
      stroke-width="3"
      opacity="0.12"
    />

    <path
      v-for="conn in connections"
      :key="conn.id"
      :d="conn.d"
      fill="none"
      :stroke="conn.color"
      stroke-width="2"
      stroke-linecap="round"
      stroke-linejoin="round"
      opacity="0.5"
    />

    <g v-for="node in commitNodes" :key="'grp-' + node.hash" class="commit-node">
      <circle
        v-if="node.isHead"
        :cx="node.cx"
        :cy="node.cy"
        r="8"
        :fill="node.color"
        opacity="0.2"
      />
      <circle
        :cx="node.cx"
        :cy="node.cy"
        r="5"
        :fill="node.color"
        stroke="#0d1117"
        stroke-width="2"
      />
    </g>

    <g v-for="node in commitNodes" :key="'lb-' + node.hash" class="commit-labels">
      <text
        :x="node.labelX"
        :y="node.cy + 4"
        fill="#8b949e"
        font-size="11"
        font-family="Consolas, Monaco, monospace"
      >{{ node.shortHash }}</text>
      <text
        :x="node.labelX + 82"
        :y="node.cy + 4"
        fill="#e6edf3"
        font-size="11"
        font-family="sans-serif"
      >{{ node.message }}</text>

      <text
        v-for="(b, bi) in node.branches"
        :key="'br-' + b"
        :x="node.labelX + 310 + bi * 110"
        :y="node.cy + 4"
        :fill="node.color"
        font-size="10"
        font-weight="bold"
        font-family="sans-serif"
      >▸ {{ b }}</text>

      <g
        v-for="(t, ti) in node.tags"
        :key="'tag-' + t"
        :transform="`translate(${node.labelX + 310 + node.branches.length * 110 + ti * 85}, ${node.cy - 7})`"
      >
        <rect width="75" height="16" rx="4" fill="#d29922" opacity="0.12" />
        <rect x="0" y="0" width="75" height="16" rx="4" fill="none" stroke="#d29922" stroke-width="1" opacity="0.6" />
        <text
          x="37"
          y="11"
          text-anchor="middle"
          fill="#d29922"
          font-size="9"
          font-weight="bold"
          font-family="sans-serif"
        >{{ t }}</text>
      </g>
    </g>
  </svg>
  <div v-else class="text-muted small text-center w-100 py-4">
    No hay commits para mostrar
  </div>
</template>

<script>
import { computed } from 'vue'

const LANE_W = 30
const ROW_H = 28
const PAD_TOP = 14
const PAD_LEFT = 16
const COLORS = [
  '#58a6ff', '#3fb950', '#d2a8ff', '#f0883e',
  '#f778ba', '#79c0ff', '#ffa657', '#56d364',
  '#bc8cff', '#ff7b72',
]

export default {
  props: {
    commits: { type: Array, default: () => [] },
    zoom: { type: Number, default: 100 },
  },
  setup(props) {
    const commitsData = computed(() => props.commits)

    const laneInfo = computed(() => {
      const list = commitsData.value
      const laneMap = {}
      let nextLane = 0

      for (let i = list.length - 1; i >= 0; i--) {
        const c = list[i]
        let lane = -1
        for (const pHash of c.parents) {
          if (pHash in laneMap) {
            lane = laneMap[pHash]
            break
          }
        }
        if (lane === -1) lane = nextLane++
        laneMap[c.hash] = lane
      }

      const rows = list.map((c, i) => ({
        ...c,
        lane: laneMap[c.hash],
        row: i,
      }))

      return { rows, laneCount: nextLane }
    })

    const graphRight = computed(() =>
      PAD_LEFT + Math.max(1, laneInfo.value.laneCount) * LANE_W
    )

    const commitNodes = computed(() => {
      const rows = laneInfo.value.rows
      const nodeMap = {}
      const result = []

      for (let i = 0; i < rows.length; i++) {
        const c = rows[i]
        const cx = PAD_LEFT + c.lane * LANE_W + LANE_W / 2
        const cy = PAD_TOP + i * ROW_H

        nodeMap[c.hash] = { ...c, cx, cy, row: i }
        result.push(nodeMap[c.hash])
      }

      for (const n of result) {
        const color = COLORS[n.lane % COLORS.length]
        n.color = color
        n.labelX = graphRight.value + 12
      }

      return result
    })

    const laneLines = computed(() => {
      const lanes = new Set()
      for (const n of commitNodes.value) {
        lanes.add(n.lane)
      }
      return Array.from(lanes)
        .sort((a, b) => a - b)
        .map(idx => ({
          idx,
          color: COLORS[idx % COLORS.length],
        }))
    })

    const connections = computed(() => {
      const list = []
      const nodeMap = {}
      for (const n of commitNodes.value) {
        nodeMap[n.hash] = n
      }

      for (const n of commitNodes.value) {
        for (const pHash of n.parents) {
          const p = nodeMap[pHash]
          if (!p) continue

          const x1 = n.cx, y1 = n.cy
          const x2 = p.cx, y2 = p.cy

          if (n.lane === p.lane) {
            list.push({
              id: n.hash + '-' + pHash,
              d: `M ${x1} ${y1} V ${y2}`,
              color: COLORS[n.lane % COLORS.length],
            })
          } else {
            const midX = (x1 + x2) / 2
            list.push({
              id: n.hash + '-' + pHash,
              d: `M ${x1} ${y1} H ${midX} V ${y2} H ${x2}`,
              color: COLORS[n.lane % COLORS.length],
            })
          }
        }
      }
      return list
    })

    const totalRows = computed(() => laneInfo.value.rows.length)
    const svgWidth = computed(() => graphRight.value + 540)
    const svgHeight = computed(() => PAD_TOP + totalRows.value * ROW_H + 12)
    const viewBoxValue = computed(() => {
      const z = (props.zoom || 100) / 100
      return `0 0 ${Math.round(svgWidth.value / z)} ${Math.round(svgHeight.value / z)}`
    })

    function laneCenter(idx) {
      return PAD_LEFT + idx * LANE_W + LANE_W / 2
    }

    return {
      commitNodes,
      laneLines,
      connections,
      totalRows,
      svgWidth,
      svgHeight,
      viewBoxValue,
      laneCenter,
    }
  },
}
</script>

<style scoped>
.git-graph-svg {
  background: #0d1117;
  min-height: 60px;
  max-width: 100%;
  height: auto;
}
</style>
