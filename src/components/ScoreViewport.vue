<script setup lang="ts">
import { ref } from 'vue'
import type { BarHitOverlayMarker } from '../types/evaluation'
import type {
  ScoreViewerDescriptor,
  ScoreViewerSessionProps,
} from '../types/viewer'

defineProps<
  ScoreViewerSessionProps & {
    viewers: readonly ScoreViewerDescriptor[]
    activeViewerId: string
  }
>()

const emit = defineEmits<{
  fileDropped: [file: File]
  selectViewer: [viewerId: string]
}>()

const viewportElement = ref<HTMLElement | null>(null)
const isDraggingOver = ref<boolean>(false)

function onDragOver(event: DragEvent): void {
  event.preventDefault()
  isDraggingOver.value = true
}

function onDragLeave(event: DragEvent): void {
  event.preventDefault()
  isDraggingOver.value = false
}

function onDrop(event: DragEvent): void {
  event.preventDefault()
  isDraggingOver.value = false
  const file = event.dataTransfer?.files?.[0]
  if (file) {
    emit('fileDropped', file)
  }
}

function formatMarkerTooltip(marker: BarHitOverlayMarker): string {
  const deltaStr =
    marker.deltaMs !== null
      ? ` (${marker.deltaMs > 0 ? '+' : ''}${marker.deltaMs}ms)`
      : ''
  if (marker.timingStatus === 'early') {
    return `${marker.label} · Early${deltaStr}`
  }
  if (marker.timingStatus === 'on-time') {
    return `${marker.label} · On Time${deltaStr}`
  }
  if (marker.timingStatus === 'late') {
    return `${marker.label} · Late${deltaStr}`
  }
  return `${marker.label} · Miss`
}

defineExpose({
  viewportElement,
})
</script>

<template>
  <main
    class="score-stage"
    :class="{ 'is-dragging': isDraggingOver }"
    data-testid="score-dropzone"
    :data-dragging="String(isDraggingOver)"
    @dragover="onDragOver"
    @dragleave="onDragLeave"
    @drop="onDrop"
  >
    <div class="stage-subheader">
      <div class="stage-subheader-left">
        <span class="file-source-tag" data-testid="loaded-file-name">
          Source: {{ loadedFileName }}
        </span>
        <div
          v-if="viewers.length > 1"
          class="viewer-switcher"
          role="group"
          aria-label="Score Viewer Mode"
          data-testid="viewer-switcher"
        >
          <button
            v-for="viewer in viewers"
            :key="viewer.id"
            type="button"
            class="btn btn-sm"
            :class="{ 'btn-active': viewer.id === activeViewerId }"
            :data-testid="`viewer-option-${viewer.id}`"
            :aria-pressed="viewer.id === activeViewerId"
            :title="viewer.description"
            @click="emit('selectViewer', viewer.id)"
          >
            {{ viewer.shortLabel }}
          </button>
        </div>
        <span class="overlay-legend" aria-label="Note Hit Color Legend">
          <span class="legend-dot is-early" aria-hidden="true" />
          <span>Early</span>
          <span class="legend-dot is-on-time" aria-hidden="true" />
          <span>On Time</span>
          <span class="legend-dot is-late" aria-hidden="true" />
          <span>Late</span>
          <span class="legend-dot is-miss" aria-hidden="true" />
          <span>Miss</span>
        </span>
      </div>
      <span class="drop-hint">
        Drag &amp; drop any <code>.gp3</code>–<code>.gp8</code> file onto the score to load
      </span>
    </div>

    <div
      v-if="errorMessage"
      class="error-banner"
      role="alert"
      data-testid="player-error-banner"
    >
      {{ errorMessage }}
    </div>

    <div
      v-if="isDraggingOver"
      class="drop-overlay"
      data-testid="drop-overlay"
    >
      <div class="drop-overlay-card">
        <strong>Drop Guitar Pro File (.gp3–.gp8)</strong>
        <span>Release to render notation and tracks in alphaTab</span>
      </div>
    </div>

    <div class="alphatab-scroll-frame" :data-active-viewer="activeViewerId">
      <div
        v-show="activeViewerId === 'alphatab-sheet'"
        class="score-sheet-wrapper"
      >
        <div
          ref="viewportElement"
          class="alphatab-surface"
          data-testid="alphatab-surface"
        ></div>

        <div
          class="bar-hit-overlay-layer"
          aria-hidden="true"
          data-testid="bar-hit-overlay"
          :data-marker-count="barHitMarkers.length"
        >
          <div
            v-for="marker in barHitMarkers"
            :key="marker.id"
            class="bar-notehead-ring"
            :class="`status-${marker.timingStatus}`"
            :style="{
              left: `${marker.noteHeadX}px`,
              top: `${marker.noteHeadY}px`,
            }"
            :title="formatMarkerTooltip(marker)"
            data-testid="bar-hit-marker"
            :data-judgment="marker.judgment"
            :data-timing-status="marker.timingStatus"
            :data-label="marker.shortLabel"
          />
        </div>
      </div>

      <slot name="custom-viewer" />
    </div>
  </main>
</template>
