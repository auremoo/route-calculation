import { createRouter, createWebHistory, createWebHashHistory } from 'vue-router'
import { useAuthStore } from '../stores/auth'

// GitHub Pages doesn't support server-side routing — use hash mode when deployed there
const history = import.meta.env.VITE_GH_PAGES
  ? createWebHashHistory(import.meta.env.BASE_URL)
  : createWebHistory(import.meta.env.BASE_URL)

const router = createRouter({
  history,
  routes: [
    { path: '/', redirect: '/calculator' },
    { path: '/login', component: () => import('../views/Login.vue') },
    { path: '/calculator', component: () => import('../views/Calculator.vue') },
    { path: '/settings', component: () => import('../views/Settings.vue') },
  ],
})

router.beforeEach(async (to) => {
  if (to.path === '/login') return true
  const auth = useAuthStore()
  if (auth.user) return true
  const ok = await auth.verify()
  if (!ok) return '/login'
  return true
})

export default router
