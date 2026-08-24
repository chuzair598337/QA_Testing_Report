<script setup>
// Settings modal — base shell + Profile + Theme + Logout (Task 5 of the
// 2026-08-24 design spec). Bin section is a stub here; Task 6 fills in its
// real recover/delete logic. Not wired into any view yet — Task 7 does
// that.
import { ref, computed, watch } from 'vue'
import { useRouter } from 'vue-router'
import { supabase } from '../lib/supabaseClient'
import { useAuth } from '../stores/useAuth'
import { useTheme } from '../composables/useTheme'
import { useModalFocus } from '../composables/useModalFocus'
import Icon from './icons/Icon.vue'
import BusyOverlay from './BusyOverlay.vue'

const props = defineProps({
  open: { type: Boolean, required: true },
})
const emit = defineEmits(['close', 'reports-changed'])

const router = useRouter()
const { user, signOut } = useAuth()
const { theme, setTheme } = useTheme()

const modalBox = ref(null)
useModalFocus(
  () => props.open,
  modalBox,
)

const activeSection = ref('profile') // 'profile' | 'bin' | 'theme'

// ---------------------------------------------------------------------
// Profile
// ---------------------------------------------------------------------
const profile = ref(null)
const profileLoading = ref(false)

async function loadProfile() {
  if (!user.value) return
  profileLoading.value = true
  const { data, error } = await supabase
    .from('profiles')
    .select('full_name,email,avatar_url')
    .eq('id', user.value.id)
    .single()
  profileLoading.value = false
  if (error) return
  profile.value = data
}

const displayName = computed(
  () => profile.value?.full_name || profile.value?.email || user.value?.email || '',
)
// Ported verbatim from MemberCard.vue's initials computed (L22-30).
const initials = computed(() => {
  const source = profile.value?.full_name || profile.value?.email || user.value?.email || '?'
  return source
    .split(/[\s@]+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase())
    .join('')
})

// ---------------------------------------------------------------------
// Bin — stub, Task 6 fills this in.
// ---------------------------------------------------------------------
const binLoading = ref(false)
function loadBin() {
  // no-op for now
  return
}

const anyBusy = computed(() => profileLoading.value || binLoading.value)

watch(
  () => props.open,
  (isOpen) => {
    if (!isOpen) return
    activeSection.value = 'profile'
    loadProfile()
    loadBin()
  },
)

function close() {
  emit('close')
}
function onModalKeydown(e) {
  if (e.key === 'Escape') close()
}

// Ported verbatim from DashboardView.vue's handleSignOut (L88-91), plus
// closing this modal before navigating away.
async function handleLogout() {
  await signOut()
  emit('close')
  router.push('/login')
}
</script>

<template>
  <div class="modal-overlay" :class="{ open }" :inert="!open" @click.self="close" @keydown="onModalKeydown">
    <div ref="modalBox" class="modal-box modal-box--settings" role="dialog" aria-modal="true">
      <!-- Sibling of the flex-column modal box's direct children below,
           never a wrapper around them — see the per-child :inert note in
           ManageAccessModal.vue for why a wrapping div would break the
           flex layout here. -->
      <BusyOverlay :active="anyBusy" label="Loading…" />

      <div class="settings-header" :inert="anyBusy">
        <h2>Settings</h2>
        <button type="button" class="icon-btn" aria-label="Close" @click="close">
          <Icon name="x" cls="icon-sm" />
        </button>
      </div>

      <div class="settings-layout" :inert="anyBusy">
        <nav class="settings-nav">
          <button
            type="button"
            class="settings-nav-item"
            :class="{ active: activeSection === 'profile' }"
            @click="activeSection = 'profile'"
          >
            <Icon name="users" cls="icon-sm" />
            <span>Profile</span>
          </button>
          <button
            type="button"
            class="settings-nav-item"
            :class="{ active: activeSection === 'bin' }"
            @click="activeSection = 'bin'"
          >
            <Icon name="trash2" cls="icon-sm" />
            <span>Bin</span>
          </button>
          <button
            type="button"
            class="settings-nav-item"
            :class="{ active: activeSection === 'theme' }"
            @click="activeSection = 'theme'"
          >
            <Icon name="moon" cls="icon-sm" />
            <span>Theme</span>
          </button>
        </nav>

        <div class="settings-panel">
          <template v-if="activeSection === 'profile'">
            <div class="settings-profile">
              <div class="settings-profile-avatar" aria-hidden="true">{{ initials }}</div>
              <div>
                <div class="settings-profile-name">{{ displayName }}</div>
                <div class="settings-profile-email">{{ profile?.email || user?.email }}</div>
              </div>
            </div>
          </template>

          <template v-else-if="activeSection === 'bin'">
            <p>Loading…</p>
          </template>

          <template v-else-if="activeSection === 'theme'">
            <div style="display: flex; gap: 8px">
              <button type="button" class="btn" :class="{ primary: theme === 'light' }" @click="setTheme('light')">
                Light
              </button>
              <button type="button" class="btn" :class="{ primary: theme === 'dark' }" @click="setTheme('dark')">
                Dark
              </button>
            </div>
          </template>
        </div>
      </div>

      <div class="settings-footer" :inert="anyBusy">
        <button type="button" class="btn danger" @click="handleLogout">
          <Icon name="logOut" cls="icon-sm" />
          <span>Log out</span>
        </button>
      </div>
    </div>
  </div>
</template>
