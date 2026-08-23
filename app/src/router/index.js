import { createRouter, createWebHistory } from 'vue-router'
import HomeView from '../views/HomeView.vue'

// createWebHistory() is a hard requirement for this project — never
// createWebHashHistory(). Vercel serves SPA routes natively via rewrites
// (see vercel.json at the repo root), so there is no need for a `#` in
// any URL.
const router = createRouter({
  history: createWebHistory(),
  routes: [
    {
      path: '/',
      name: 'home',
      component: HomeView,
    },
  ],
})

export default router
