<script setup>
// One module block: header (collapse toggle, pin/lock "more options" menu,
// mini pass/fail bar) + its sub-module cards. Ported visually/behaviorally
// from js/app.js's render() module block (~line 574) and buildMenuWrap()
// (~line 276, pin/lock + bulk-mark dropdown).
import { inject, computed } from 'vue'
import Icon from './icons/Icon.vue'
import SubModuleCard from './SubModuleCard.vue'

const props = defineProps({
  mod: { type: Object, required: true }, // tree node: { id, num, name, subModules, stats, hasVisibleSub, hidden }
  statusBusy: { type: Object, default: () => ({}) },
  onStatusChange: { type: Function, required: true },
  onNoteInput: { type: Function, required: true },
  onBulkMark: { type: Function, required: true },
})

const treeUi = inject('treeUi')
const canEdit = inject('canEdit')
const filterActive = inject('filterActive')

const locked = computed(() => !!treeUi.lockedModules[props.mod.id])
const pinned = computed(() => !!treeUi.pinnedModules[props.mod.id])

const collapsed = computed(() => {
  if (filterActive.value) return !props.mod.hasVisibleSub
  return treeUi.isModuleCollapsed(props.mod.id)
})

const menuKey = computed(() => `mod-${props.mod.id}`)
const menuOpen = computed(() => treeUi.openMenuKey.value === menuKey.value)
const allTests = computed(() => props.mod.subModules.flatMap((sm) => sm.tests))
const bulkDisabled = computed(() => locked.value || allTests.value.length === 0 || !canEdit.value)

function toggleMenu(e) {
  e.stopPropagation()
  treeUi.toggleMenu(menuKey.value)
}
function toggleCollapse() {
  treeUi.toggleCollapseModule(props.mod.id)
}
function onPin() {
  treeUi.closeMenu()
  treeUi.togglePinModule(props.mod.id)
}
function onLock() {
  treeUi.closeMenu()
  treeUi.toggleLockModule(props.mod.id)
}
function onBulk(status) {
  treeUi.closeMenu()
  props.onBulkMark(allTests.value, status, props.mod.name)
}
function pct(count, total) {
  return total > 0 ? (count / total) * 100 : 0
}
</script>

<template>
  <section :id="`mod-${mod.num}`" class="module" :class="{ collapsed, 'filtered-out': mod.hidden }">
    <div class="module-head" @click="toggleCollapse">
      <div class="module-head-left">
        <span class="chevron-icon"><Icon name="chevronDown" /></span>
        <span class="module-num">{{ mod.num }}.</span>
        <span class="module-title">{{ mod.name }}</span>
        <span v-if="pinned" class="pin-badge" title="Pinned"><Icon name="pin" cls="icon-sm" /></span>
        <span v-if="locked" class="lock-badge" title="Locked"><Icon name="lock" cls="icon-sm" /></span>
      </div>

      <div class="module-meta" @click.stop>
        <div class="menu-wrap">
          <button
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
          <div class="dropdown-menu" :class="{ open: menuOpen }">
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
        </div>
      </div>

      <div class="module-head-progress">
        <span class="module-count">{{ mod.stats.pass }}/{{ mod.stats.total }} pass</span>
        <div class="mini-bar">
          <div class="progress-seg pass" :style="{ width: pct(mod.stats.pass, mod.stats.total) + '%' }"></div>
          <div class="progress-seg fail" :style="{ width: pct(mod.stats.fail, mod.stats.total) + '%' }"></div>
        </div>
      </div>
    </div>

    <div class="module-body">
      <SubModuleCard
        v-for="sm in mod.subModules"
        v-show="!sm.hidden"
        :key="sm.id"
        :sm="sm"
        :module-locked="locked"
        :status-busy="statusBusy"
        :on-status-change="onStatusChange"
        :on-note-input="onNoteInput"
        :on-bulk-mark="onBulkMark"
      />
    </div>
  </section>
</template>
