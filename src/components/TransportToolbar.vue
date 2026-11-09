<script setup lang="ts">
import { computed, ref } from 'vue'
import type { TrackSummary } from '../composables/useAlphaTab'

const props = defineProps<{
  isReady: boolean
  isPlayerReady: boolean
  isSoundFontLoaded: boolean
  isPlaying: boolean
  isFinished: boolean
  isLooping: boolean
  tempoPercent: number
  baseTempoBpm: number
  scoreTitle: string
  loadedFileName: string
  sourceType: 'alphatex' | 'gp-file'
  tracks: readonly TrackSummary[]
  activeTrackIndex: number
  currentTick: number
  currentTimeMs: number
}>()

const emit = defineEmits<{
  togglePlayPause: []
  stop: []
  toggleLoop: []
  updateTempo: [percent: number]
  selectTrack: [index: number]
  uploadFile: [file: File]
  resetDemo: []
  openSoundSettings: []
}>()

const fileInputRef = ref<HTMLInputElement | null>(null)

const effectiveBpm = computed(() =>
  Math.round((props.baseTempoBpm * props.tempoPercent) / 100),
)

const formattedTime = computed(() => {
  const totalSec = Math.floor(props.currentTimeMs / 1000)
  const mins = Math.floor(totalSec / 60)
  const secs = totalSec % 60
  return `${String(mins).padStart(2, '0')}:${String(secs).padStart(2, '0')}`
})

function onTempoInput(event: Event): void {
  const target = event.target as HTMLInputElement
  const value = Number(target.value)
  if (!Number.isNaN(value)) {
    emit('updateTempo', value)
  }
}

function onTrackChange(event: Event): void {
  const target = event.target as HTMLSelectElement
  const index = Number(target.value)
  if (!Number.isNaN(index)) {
    emit('selectTrack', index)
  }
}

function openFilePicker(): void {
  fileInputRef.value?.click()
}

function onFileSelected(event: Event): void {
  const target = event.target as HTMLInputElement
  const file = target.files?.[0]
  if (file) {
    emit('uploadFile', file)
    target.value = ''
  }
}
</script>

<template>
  <header
    class="transport-toolbar"
    data-testid="transport-toolbar"
    :data-is-playing="String(isPlaying)"
    :data-is-looping="String(isLooping)"
    :data-tempo="tempoPercent"
    :data-active-track="activeTrackIndex"
  >
    <div class="brand-cluster">
      <div class="brand-badge" aria-hidden="true">W</div>
      <div class="score-meta">
        <div class="app-title-row">
          <span class="app-name">WHIPLASH</span>
          <span
            class="engine-pill"
            :class="{ ready: isReady }"
            data-testid="engine-status-pill"
          >
            {{ isReady ? (isSoundFontLoaded ? 'Synth Ready' : 'Score Ready') : 'Loading…' }}
          </span>
        </div>
        <h1 class="score-title" data-testid="score-title">{{ scoreTitle }}</h1>
      </div>
    </div>

    <div class="transport-controls" role="group" aria-label="Playback Controls">
      <button
        type="button"
        class="btn btn-primary"
        data-testid="transport-play-pause"
        :disabled="!isReady"
        :aria-pressed="isPlaying"
        @click="emit('togglePlayPause')"
      >
        <span aria-hidden="true">{{
          isPlaying ? '⏸' : isFinished ? '↺' : '▶'
        }}</span>
        <span>{{
          isPlaying ? 'Pause' : isFinished ? 'Replay' : 'Play'
        }}</span>
      </button>

      <button
        type="button"
        class="btn"
        data-testid="transport-stop"
        :disabled="!isReady"
        :title="
          isPlaying
            ? 'Halt playback in place to analyze results'
            : 'Rewind cursor to the start of the score'
        "
        @click="emit('stop')"
      >
        <span aria-hidden="true">{{
          !isPlaying && currentTick > 0 ? '⏮' : '⏹'
        }}</span>
        <span>{{
          !isPlaying && currentTick > 0 ? 'Start' : 'Stop'
        }}</span>
      </button>

      <button
        type="button"
        class="btn"
        :class="{ 'btn-active': isLooping }"
        data-testid="transport-loop"
        :aria-pressed="isLooping"
        :disabled="!isReady"
        @click="emit('toggleLoop')"
      >
        <span aria-hidden="true">🔁</span>
        <span>Loop {{ isLooping ? 'On' : 'Off' }}</span>
      </button>

      <div class="position-readout" data-testid="transport-position">
        <span class="readout-time">{{ formattedTime }}</span>
        <span class="readout-tick">Tick {{ currentTick }}</span>
      </div>
    </div>

    <div class="tempo-cluster">
      <label class="control-label" for="tempo-slider">
        <span>Tempo</span>
        <strong data-testid="tempo-display">{{ tempoPercent }}% ({{ effectiveBpm }} BPM)</strong>
      </label>
      <input
        id="tempo-slider"
        type="range"
        min="25"
        max="200"
        step="5"
        :value="tempoPercent"
        :style="{ '--progress': `${((tempoPercent - 25) / 175) * 100}%` }"
        data-testid="transport-tempo"
        @input="onTempoInput"
      />
    </div>

    <div class="track-file-cluster">
      <div class="track-selector-wrap">
        <label class="control-label" for="track-select">Track</label>
        <select
          id="track-select"
          class="track-select"
          data-testid="track-selector"
          :value="activeTrackIndex"
          :disabled="tracks.length === 0"
          @change="onTrackChange"
        >
          <option
            v-for="track in tracks"
            :key="track.index"
            :value="track.index"
          >
            {{ track.index + 1 }}. {{ track.name }}
            {{ track.isPercussion ? '(Percussion)' : '(Melodic)' }}
          </option>
        </select>
      </div>

      <div class="file-actions">
        <input
          ref="fileInputRef"
          type="file"
          accept=".gp,.gp3,.gp4,.gp5,.gpx,.gp7,.gp8"
          class="sr-only"
          data-testid="file-upload-input"
          @change="onFileSelected"
        />
        <button
          type="button"
          class="btn"
          data-testid="open-sound-settings"
          @click="emit('openSoundSettings')"
        >
          <span aria-hidden="true">🎛</span>
          <span>Sound Settings</span>
        </button>
        <button
          type="button"
          class="btn"
          data-testid="open-file-button"
          @click="openFilePicker"
        >
          <span aria-hidden="true">📂</span>
          <span>Load .GP</span>
        </button>
        <button
          v-if="sourceType === 'gp-file'"
          type="button"
          class="btn"
          data-testid="reset-demo-button"
          @click="emit('resetDemo')"
        >
          <span aria-hidden="true">↺</span>
          <span>Demo Groove</span>
        </button>
      </div>
    </div>
  </header>
</template>
