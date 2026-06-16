<template>
  <div class="json-tree" :style="{ paddingLeft: depth === 0 ? '0.25em' : '1.25em' }">
    <div v-if="isObjectOrArray" class="json-entry">
      <span class="json-toggle" @click="toggle">
        <span v-if="collapsed">&#9654;</span>
        <span v-else>&#9660;</span>
      </span>
      <span v-if="keyName !== null" class="json-key">{{ keyDisplay }}</span>
      <span v-if="isObject" class="json-bracket">
        <template v-if="collapsed">{{ '{ ' }}{{ keys.length }} key{{ keys.length !== 1 ? 's' : '' }}{{ ' }' }}</template>
        <template v-else>{{ '{' }}</template>
      </span>
      <span v-if="isArray" class="json-bracket">
        <template v-if="collapsed">{{ '[ ' }}{{ data.length }} item{{ data.length !== 1 ? 's' : '' }}{{ ' ]' }}</template>
        <template v-else>{{ '[' }}</template>
      </span>
      <div v-if="!collapsed" class="json-children">
        <template v-for="(val, key) in data" :key="key">
          <JsonTreeView :data="val" :key-name="isArray ? Number(key) : key" :depth="depth + 1" />
        </template>
      </div>
      <div v-if="!collapsed && depth === 0" class="json-close-bracket">{{ isObject ? '}' : ']' }}</div>
    </div>
    <div v-else class="json-leaf" :style="{ paddingLeft: depth > 0 ? '0' : '1.5em' }">
      <span v-if="keyName !== null" class="json-key">{{ keyDisplay }}</span>
      <span :class="valueClass">{{ formattedValue }}</span>
    </div>
  </div>
</template>

<script>
export default {
  name: 'JsonTreeView',
  props: {
    data: { required: true },
    keyName: { default: null },
    depth: { type: Number, default: 0 },
  },
  data() {
    return {
      collapsed: this.depth > 0,
    }
  },
  computed: {
    isObjectOrArray() {
      return this.data !== null && typeof this.data === 'object'
    },
    isObject() {
      return this.data !== null && typeof this.data === 'object' && !Array.isArray(this.data)
    },
    isArray() {
      return Array.isArray(this.data)
    },
    keys() {
      if (this.data === null || typeof this.data !== 'object') return []
      return Object.keys(this.data)
    },
    keyDisplay() {
      if (this.keyName === null) return ''
      if (typeof this.keyName === 'number') return `[${this.keyName}]`
      return `${this.keyName}: `
    },
    valueClass() {
      if (this.data === null) return 'json-null'
      if (typeof this.data === 'string') return 'json-string'
      if (typeof this.data === 'number') return 'json-number'
      if (typeof this.data === 'boolean') return 'json-boolean'
      return ''
    },
    formattedValue() {
      if (this.data === null) return 'null'
      if (typeof this.data === 'string') {
        if (this.data.length > 500) return `"${this.data.slice(0, 500)}..."`
        return `"${this.data}"`
      }
      return String(this.data)
    },
  },
  methods: {
    toggle() {
      this.collapsed = !this.collapsed
    },
  },
}
</script>

<style scoped>
.json-tree {
  font-family: 'Consolas', 'Monaco', 'Courier New', monospace;
  font-size: 0.85rem;
  line-height: 1.6;
  color: #e0e0e0;
  text-align: left;
}
.json-entry {
  white-space: nowrap;
}
.json-toggle {
  cursor: pointer;
  user-select: none;
  color: #75AADB;
  margin-right: 0.25em;
  font-size: 0.7rem;
  display: inline-block;
  width: 0.8em;
}
.json-toggle:hover {
  color: #9ac8f0;
}
.json-key {
  color: #67e8f9;
  margin-right: 0.25em;
}
.json-bracket {
  color: #e0e0e0;
}
.json-children {
  margin-left: 0;
}
.json-close-bracket {
  color: #e0e0e0;
  margin-top: 0;
}
.json-leaf {
  white-space: nowrap;
}
.json-string {
  color: #86efac;
}
.json-number {
  color: #fbbf24;
}
.json-boolean {
  color: #c084fc;
}
.json-null {
  color: #9ca3af;
  font-style: italic;
}
</style>
