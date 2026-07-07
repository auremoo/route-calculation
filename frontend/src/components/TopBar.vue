<script setup lang="ts">
import { useRoute } from 'vue-router'

const route = useRoute()
</script>

<template>
  <header class="border-b border-ink-100 bg-white shadow-soft sticky top-0 z-40">
    <div class="max-w-5xl mx-auto px-4 h-12 flex items-center justify-between gap-4">
      <!-- Logo -->
      <div class="flex items-center gap-2 flex-shrink-0">
        <span class="text-lg">🚗</span>
        <span class="font-bold text-ink-900 text-sm tracking-tight">RouteCalc</span>
      </div>

      <!-- Nav -->
      <nav class="flex items-center gap-1">
        <router-link
          to="/calculator"
          class="px-3 py-1.5 rounded text-sm font-medium transition-colors"
          :class="route.path === '/calculator' ? 'bg-ink-50 text-ink-900' : 'text-ink-500 hover:text-ink-800 hover:bg-ink-50'"
        >
          Calculateur
        </router-link>
        <router-link
          to="/settings"
          class="px-3 py-1.5 rounded text-sm font-medium transition-colors"
          :class="route.path === '/settings' ? 'bg-ink-50 text-ink-900' : 'text-ink-500 hover:text-ink-800 hover:bg-ink-50'"
        >
          Véhicules
        </router-link>
      </nav>
    </div>
  </header>
</template>
