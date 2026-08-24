// Theme toggle — light/dark, persisted to localStorage.
// Ported from js/theme.js (legacy static app): same prefers-color-scheme
// seeding, same toggle behavior. Now with localStorage persistence.
import { ref } from 'vue'

const THEME_STORAGE_KEY = 'qa-report:theme'

const theme = ref(getInitialTheme())

function getInitialTheme() {
  // Try to get stored theme first
  if (typeof window !== 'undefined' && window.localStorage) {
    const stored = window.localStorage.getItem(THEME_STORAGE_KEY)
    if (stored === 'light' || stored === 'dark') {
      return stored
    }
  }

  // Fall back to prefers-color-scheme
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
  // Persist to localStorage
  if (typeof window !== 'undefined' && window.localStorage) {
    window.localStorage.setItem(THEME_STORAGE_KEY, value)
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
