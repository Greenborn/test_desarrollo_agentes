<template>
  <router-view />
  <AppModal />
</template>

<script>
import AppModal from './components/AppModal.vue'

export default {
  components: { AppModal },
}
</script>
