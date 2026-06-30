<template>
  <div>
    <div v-for="(cmds, cat) in categories" :key="cat" class="mb-4">
      <h6 class="text-success text-uppercase small mb-2">{{ cat }}</h6>
      <div v-for="c in cmds" :key="c.name" class="mb-2 ps-2 border-start border-secondary">
        <code class="text-warning">{{ c.usage }}</code>
        <p class="mb-0 small text-light-emphasis">{{ c.description }}</p>
      </div>
    </div>
  </div>
</template>

<script>
import { useCommandRegistry } from '../../composables/useCommandRegistry.js'

export default {
  setup() {
    const { categories } = useCommandRegistry()
    return { categories: categories() }
  },
}
</script>
