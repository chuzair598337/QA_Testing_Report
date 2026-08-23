// Theme toggle — light/dark, kept in memory for this session.
// Ported from js/theme.js (legacy static app): same prefers-color-scheme
// seeding, same toggle behavior. Still session-only — no persistence, no
// Supabase involvement.
import { ref } from 'vue'

const theme = ref(getInitialTheme())

function getInitialTheme() {
  const prefersDark =
    typeof window !== 'undefined' &&
    window.matchMedia &&
    window.matchMedia('(prefers-color-scheme: dark)').matches
  return prefersDark ? 'dark' : 'light'
}

function applyTheme(value) {
  if (typeof document !== 'undefined') {
    document.documentElement.dataset.theme = value
  }
}

// Seed the DOM immediately so the composable behaves the same whether it's
// imported once at app startup or lazily by a component.
applyTheme(theme.value)

export function useTheme() {
  function setTheme(value) {
    theme.value = value
    applyTheme(value)
  }

  function toggleTheme() {
    setTheme(theme.value === 'dark' ? 'light' : 'dark')
  }

  return { theme, setTheme, toggleTheme }
}
