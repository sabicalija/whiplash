import { computed, readonly, ref } from 'vue'
import type { ScoreViewerDescriptor } from '../types/viewer'

export const DEFAULT_SHEET_VIEWER: ScoreViewerDescriptor = {
  id: 'alphatab-sheet',
  label: 'Sheet & Tab Notation',
  shortLabel: 'Sheet / Tab',
  description: 'Standard drum notation and guitar/bass tablature powered by alphaTab',
  usesAlphaTabSurface: true,
}

const viewers = ref<ScoreViewerDescriptor[]>([DEFAULT_SHEET_VIEWER])
const activeViewerId = ref<string>(DEFAULT_SHEET_VIEWER.id)

const activeViewer = computed<ScoreViewerDescriptor>(() => {
  return (
    viewers.value.find((v) => v.id === activeViewerId.value) ??
    DEFAULT_SHEET_VIEWER
  )
})

/**
 * Pluggable Score Viewer Registry (`useViewerRegistry.ts`).
 *
 * Allows registering and switching between visualizers (`alphatab-sheet`,
 * step-sequencer bar grids, falling-note highways, etc.) that consume the
 * engine-agnostic `ScoreViewerSessionProps` contract (`bars`, `targetNotes`,
 * `resultsByNoteId`, `currentTick`).
 */
export function useViewerRegistry() {
  function registerViewer(descriptor: ScoreViewerDescriptor): void {
    const idx = viewers.value.findIndex((v) => v.id === descriptor.id)
    if (idx >= 0) {
      const next = [...viewers.value]
      next[idx] = descriptor
      viewers.value = next
    } else {
      viewers.value = [...viewers.value, descriptor]
    }
  }

  function selectViewer(viewerId: string): void {
    if (viewers.value.some((v) => v.id === viewerId)) {
      activeViewerId.value = viewerId
    }
  }

  return {
    viewers: readonly(viewers),
    activeViewerId: readonly(activeViewerId),
    activeViewer,
    registerViewer,
    selectViewer,
  }
}
