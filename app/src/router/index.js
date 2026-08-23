import { createRouter, createWebHistory } from 'vue-router'
import { supabase } from '../lib/supabaseClient'
import HomeView from '../views/HomeView.vue'
import LoginView from '../views/LoginView.vue'
import SignupView from '../views/SignupView.vue'
import ResetPasswordView from '../views/ResetPasswordView.vue'
import AuthCallbackView from '../views/AuthCallbackView.vue'
import InviteView from '../views/InviteView.vue'
import DashboardView from '../views/DashboardView.vue'
import ReportView from '../views/ReportView.vue'

// createWebHistory() is a hard requirement for this project — never
// createWebHashHistory(). Vercel serves SPA routes natively via rewrites
// (see vercel.json at the repo root), so there is no need for a `#` in
// any URL.
const router = createRouter({
  history: createWebHistory(),
  routes: [
    {
      // Kept from Phase 1 as the public placeholder landing page — not
      // wired into requiresAuth, and not removed since it still validates
      // the build pipeline / ported design tokens independent of auth.
      path: '/',
      name: 'home',
      component: HomeView,
    },
    {
      path: '/login',
      name: 'login',
      component: LoginView,
    },
    {
      path: '/signup',
      name: 'signup',
      component: SignupView,
    },
    {
      path: '/reset-password',
      name: 'reset-password',
      component: ResetPasswordView,
    },
    {
      // OAuth / magic-link / invite redirect landing — establishes the
      // session, then forwards to dashboard or /invite.
      path: '/auth/callback',
      name: 'auth-callback',
      component: AuthCallbackView,
    },
    {
      path: '/invite',
      name: 'invite',
      component: InviteView,
    },
    {
      path: '/dashboard',
      name: 'dashboard',
      component: DashboardView,
      meta: { requiresAuth: true },
    },
    {
      path: '/reports/:id',
      name: 'report',
      component: ReportView,
      meta: { requiresAuth: true },
    },
  ],
})

router.beforeEach(async (to) => {
  if (!to.meta.requiresAuth) return true

  const { data } = await supabase.auth.getSession()
  if (!data.session) {
    return { name: 'login', query: { redirect: to.fullPath } }
  }

  return true
})

export default router
