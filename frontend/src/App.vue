<script setup lang="ts">
import TopBar from './components/TopBar.vue'
</script>

<template>
  <div class="min-h-screen bg-cream-50">
    <TopBar />
    <main class="max-w-5xl mx-auto px-4 py-6">
      <router-view />
    </main>
  </div>
</template>
