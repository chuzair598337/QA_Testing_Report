// Minimal modal focus management, applied to every modal-overlay instance
// (create-report, manage-access, confirm, generate-report). On open: moves
// focus to the first focusable control inside the modal. On close: restores
// focus to whatever had it before (normally the button that opened the
// modal), so keyboard users land back where they started.
//
// Pairs with the `inert` attribute bound on each `.modal-overlay`/
// `.dropdown-menu` in the templates — `inert` is what keeps a *closed*
// overlay's controls out of the tab order; this composable only handles
// focus placement while a modal is open/closing.
import { watch, nextTick } from 'vue'

const FOCUSABLE =
  'input:not([disabled]), textarea:not([disabled]), select:not([disabled]), ' +
  'button:not([disabled]), a[href], [tabindex]:not([tabindex="-1"])'

export function useModalFocus(isOpen, containerRef) {
  let lastFocused = null

  watch(isOpen, async (open) => {
    if (open) {
      lastFocused = document.activeElement
      await nextTick()
      containerRef.value?.querySelector(FOCUSABLE)?.focus()
    } else if (lastFocused) {
      lastFocused.focus?.()
      lastFocused = null
    }
  })
}
