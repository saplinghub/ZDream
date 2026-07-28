<script setup lang="ts">
import { useAppStore } from '@/stores/app'
const store = useAppStore()
</script>

<template>
  <div class="toast" :class="{ show: store.toastVisible }">{{ store.toastMsg }}</div>
</template>
