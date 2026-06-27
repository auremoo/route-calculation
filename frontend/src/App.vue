<script setup lang="ts">
import TopBar from './components/TopBar.vue'
import { useRoute } from 'vue-router'

const route = useRoute()
const isLogin = () => route.path === '/login'
</script>

<template>
  <div class="min-h-screen bg-cream-50">
    <TopBar v-if="!isLogin()" />
    <main :class="isLogin() ? '' : 'max-w-5xl mx-auto px-4 py-6'">
      <router-view />
    </main>
  </div>
</template>
