<script setup lang="ts">
import { ref } from 'vue'

defineProps<{
  isReady: boolean
  loadedFileName: string
  errorMessage: string | null
}>()

const emit = defineEmits<{
  fileDropped: [file: File]
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
      <span class="file-source-tag" data-testid="loaded-file-name">
        Source: {{ loadedFileName }}
      </span>
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

    <div class="alphatab-scroll-frame">
      <div
        ref="viewportElement"
        class="alphatab-surface"
        data-testid="alphatab-surface"
      ></div>
    </div>
  </main>
</template>
