<script setup>
// One sub-module block: header (collapse toggle, pin/lock "more options"
// menu, mini pass/fail bar) + its test rows. Ported visually/behaviorally
// from js/app.js's render() sub-module block (~line 616) and buildMenuWrap()
// (~line 276, pin/lock + bulk-mark dropdown).
import { inject, computed, ref, watch, nextTick } from 'vue'
import Icon from './icons/Icon.vue'
import TestRow from './TestRow.vue'

const props = defineProps({
  sm: { type: Object, required: true }, // tree node: { id, num, name, tests, stats, hasVisible, hidden }
  moduleLocked: { type: Boolean, default: false },
  statusBusy: { type: Object, default: () => ({}) },
  onStatusChange: { type: Function, required: true },
  onNoteInput: { type: Function, required: true },
  onBulkMark: { type: Function, required: true },
})

const treeUi = inject('treeUi')
const canEdit = inject('canEdit')
const filterActive = inject('filterActive')

const locked = computed(() => props.moduleLocked || !!treeUi.lockedSubModules[props.sm.id])
const pinned = computed(() => !!treeUi.pinnedSubModules[props.sm.id])

// While a filter/search is active, auto-expand sub-modules with visible
// matches regardless of their saved collapsed state; restore the saved
// state once the filter clears (mirrors applyFilter() in the legacy app).
const collapsed = computed(() => {
  if (filterActive.value) return !props.sm.hasVisible
  return treeUi.isSubCollapsed(props.sm.id)
})

const menuKey = computed(() => `sub-${props.sm.id}`)
const menuOpen = computed(() => treeUi.openMenuKey.value === menuKey.value)
const bulkDisabled = computed(() => locked.value || props.sm.tests.length === 0 || !canEdit.value)

// Same overflow:hidden-clipping fix as ModuleCard.vue's menu — see its
// comment for the full explanation. .submodule doesn't set overflow:hidden
// itself, but nests inside .module which does, so it's clipped the same way.
const triggerRef = ref(null)
const menuStyle = ref({})
watch(menuOpen, async (isOpen) => {
  if (!isOpen) return
  await nextTick()
  const rect = triggerRef.value?.getBoundingClientRect()
  if (!rect) return
  menuStyle.value = {
    top: `${rect.bottom + 4}px`,
    right: `${window.innerWidth - rect.right}px`,
  }
})

function toggleMenu(e) {
  e.stopPropagation()
  treeUi.toggleMenu(menuKey.value)
}
function toggleCollapse() {
  treeUi.toggleCollapseSub(props.sm.id)
}
function onPin() {
  treeUi.closeMenu()
  treeUi.togglePinSub(props.sm.id)
}
function onLock() {
  treeUi.closeMenu()
  treeUi.toggleLockSub(props.sm.id)
}
function onBulk(status) {
  treeUi.closeMenu()
  props.onBulkMark(props.sm.tests, status, props.sm.name)
}
function pct(count, total) {
  return total > 0 ? (count / total) * 100 : 0
}
</script>

<template>
  <div :id="`sub-${sm.num}`" class="submodule" :class="{ collapsed, 'filtered-out': sm.hidden }">
    <div class="submodule-title" @click="toggleCollapse">
      <div class="submodule-head-left">
        <span class="chevron-icon"><Icon name="chevronDown" /></span>
        <span class="sub-num">{{ sm.num }}.</span>
        <span class="sub-title-text">{{ sm.name }}</span>
        <span v-if="pinned" class="pin-badge" title="Pinned"><Icon name="pin" cls="icon-sm" /></span>
        <span v-if="locked" class="lock-badge" title="Locked"><Icon name="lock" cls="icon-sm" /></span>
      </div>

      <div class="submodule-meta" @click.stop>
        <div class="menu-wrap">
          <button
            ref="triggerRef"
            type="button"
            class="icon-btn"
            :class="{ 'active-state': pinned || locked }"
            aria-haspopup="true"
            :aria-expanded="menuOpen"
            title="More options"
            @click="toggleMenu"
          >
            <Icon name="ellipsisVertical" />
          </button>
          <Teleport to="body">
            <div
              class="dropdown-menu dropdown-menu--floating"
              :class="{ open: menuOpen }"
              :style="menuStyle"
              :inert="!menuOpen"
            >
              <button type="button" class="dropdown-item" @click.stop="onPin">
                <Icon :name="pinned ? 'pinOff' : 'pin'" cls="icon-sm" />
                <span>{{ pinned ? 'Unpin' : 'Pin' }}</span>
              </button>
              <button type="button" class="dropdown-item" @click.stop="onLock">
                <Icon :name="locked ? 'lockOpen' : 'lock'" cls="icon-sm" />
                <span>{{ locked ? 'Unlock' : 'Lock' }}</span>
              </button>
              <div class="dropdown-divider"></div>
              <button type="button" class="dropdown-item" :disabled="bulkDisabled" @click.stop="onBulk('pass')">
                <span class="status-dot pass"></span><span>Mark all Pass</span>
              </button>
              <button type="button" class="dropdown-item" :disabled="bulkDisabled" @click.stop="onBulk('fail')">
                <span class="status-dot fail"></span><span>Mark all Fail</span>
              </button>
              <button type="button" class="dropdown-item" :disabled="bulkDisabled" @click.stop="onBulk('pending')">
                <span class="status-dot pending"></span><span>Mark all Pending</span>
              </button>
            </div>
          </Teleport>
        </div>
      </div>

      <div class="submodule-head-progress">
        <span class="sub-count">{{ sm.stats.pass }}/{{ sm.stats.total }}</span>
        <div class="mini-bar">
          <div class="progress-seg pass" :style="{ width: pct(sm.stats.pass, sm.stats.total) + '%' }"></div>
          <div class="progress-seg fail" :style="{ width: pct(sm.stats.fail, sm.stats.total) + '%' }"></div>
        </div>
      </div>
    </div>

    <div class="submodule-body">
      <TestRow
        v-for="t in sm.tests"
        v-show="t.visible"
        :key="t.id"
        :test="t"
        :locked="locked"
        :disabled="!canEdit"
        :busy="!!statusBusy[t.id]"
        @status-change="onStatusChange(t, $event)"
        @note-input="onNoteInput(t, $event)"
      />
    </div>
  </div>
</template>
