import { createRouter, createWebHistory, createWebHashHistory } from 'vue-router'

// GitHub Pages doesn't support server-side routing — use hash mode when deployed there
const history = import.meta.env.VITE_GH_PAGES
  ? createWebHashHistory(import.meta.env.BASE_URL)
  : createWebHistory(import.meta.env.BASE_URL)

const router = createRouter({
  history,
  routes: [
    { path: '/', redirect: '/calculator' },
    { path: '/calculator', component: () => import('../views/Calculator.vue') },
    { path: '/settings', component: () => import('../views/Settings.vue') },
  ],
})

export default router
