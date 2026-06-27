<script setup lang="ts">
import { useRouter, useRoute } from 'vue-router'
import { useAuthStore } from '../stores/auth'
import { getLocale, setLocale } from '../i18n/index'
import { ref, onMounted, onUnmounted } from 'vue'
import { LogOut, ChevronDown } from 'lucide-vue-next'

const router = useRouter()
const route = useRoute()
const auth = useAuthStore()
const menuOpen = ref(false)
const locale = ref(getLocale())

function closeMenu(e: MouseEvent) {
  const target = e.target as HTMLElement
  if (!target.closest('[data-user-menu]')) menuOpen.value = false
}
onMounted(() => document.addEventListener('click', closeMenu))
onUnmounted(() => document.removeEventListener('click', closeMenu))

function switchLocale(lang: string) {
  setLocale(lang)
  locale.value = lang
}

async function handleLogout() {
  await auth.logout()
  router.push('/login')
}
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

      <!-- Right side -->
      <div class="flex items-center gap-2">
        <!-- Lang switcher -->
        <div class="flex items-center border border-ink-100 rounded overflow-hidden text-xs">
          <button
            @click="switchLocale('fr')"
            :class="locale === 'fr' ? 'bg-ink-800 text-white' : 'text-ink-500 hover:bg-ink-50'"
            class="px-2 py-1 transition-colors font-medium"
          >FR</button>
          <button
            @click="switchLocale('en')"
            :class="locale === 'en' ? 'bg-ink-800 text-white' : 'text-ink-500 hover:bg-ink-50'"
            class="px-2 py-1 transition-colors font-medium"
          >EN</button>
        </div>

        <!-- User menu -->
        <div class="relative" data-user-menu>
          <button
            @click="menuOpen = !menuOpen"
            class="flex items-center gap-1.5 px-2.5 py-1.5 rounded border border-ink-100 text-xs text-ink-500 hover:bg-ink-50 transition-colors"
          >
            <span class="font-medium text-ink-800">{{ auth.user?.name }}</span>
            <ChevronDown :size="12" />
          </button>
          <div
            v-if="menuOpen"
            class="absolute right-0 top-full mt-1 w-40 bg-white border border-ink-100 rounded shadow-medium z-50"
          >
            <button
              @click="handleLogout(); menuOpen = false"
              class="w-full flex items-center gap-2 px-3 py-2.5 text-sm text-red-600 hover:bg-red-50 transition-colors"
            >
              <LogOut :size="14" /> Déconnexion
            </button>
          </div>
        </div>
      </div>
    </div>
  </header>
</template>
