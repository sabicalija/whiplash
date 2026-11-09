<script setup lang="ts">
import { onMounted, onBeforeUnmount, ref } from 'vue'
import type { TrackSummary } from '../composables/useAlphaTab'

defineProps<{
  tracks: readonly TrackSummary[]
  activeTrackIndex: number
  masterVolumePercent: number
  metronomeVolumePercent: number
  padVolumePercent: number
  isPadAudioEnabled: boolean
}>()

const emit = defineEmits<{
  updateMasterVolume: [percent: number]
  updateMetronomeVolume: [percent: number]
  updatePadVolume: [percent: number]
  togglePadAudio: []
  updateTrackVolume: [trackIndex: number, percent: number]
  toggleTrackMute: [trackIndex: number]
  toggleTrackSolo: [trackIndex: number]
  resetAll: []
}>()

const dialogRef = ref<HTMLDialogElement | null>(null)

function open(): void {
  const dialog = dialogRef.value
  if (dialog && !dialog.open) {
    dialog.showModal()
  }
}

function close(): void {
  const dialog = dialogRef.value
  if (dialog && dialog.open) {
    dialog.close()
  }
}

function handleBackdropClick(event: MouseEvent): void {
  const dialog = dialogRef.value
  if (!dialog || event.target !== dialog) {
    return
  }
  const rect = dialog.getBoundingClientRect()
  const isDialogContent =
    rect.top <= event.clientY &&
    event.clientY <= rect.top + rect.height &&
    rect.left <= event.clientX &&
    event.clientX <= rect.left + rect.width

  if (!isDialogContent) {
    dialog.close()
  }
}

let hasFallbackListener = false

onMounted(() => {
  const dialog = dialogRef.value
  if (
    dialog &&
    typeof HTMLDialogElement !== 'undefined' &&
    !('closedBy' in HTMLDialogElement.prototype)
  ) {
    dialog.addEventListener('click', handleBackdropClick)
    hasFallbackListener = true
  }
})

onBeforeUnmount(() => {
  const dialog = dialogRef.value
  if (dialog && hasFallbackListener) {
    dialog.removeEventListener('click', handleBackdropClick)
    hasFallbackListener = false
  }
})

function onRangeInput(event: Event, callback: (val: number) => void): void {
  const target = event.target as HTMLInputElement
  const value = Number(target.value)
  if (!Number.isNaN(value)) {
    callback(value)
  }
}

defineExpose({
  open,
  close,
})
</script>

<template>
  <dialog
    ref="dialogRef"
    v-bind="{ closedby: 'any' }"
    class="sound-settings-dialog"
    aria-labelledby="sound-settings-title"
    data-testid="sound-settings-dialog"
  >
    <div class="dialog-panel">
      <header class="dialog-header">
        <div>
          <h2 id="sound-settings-title" class="dialog-title">
            Sound &amp; Track Mixer
          </h2>
          <p class="dialog-subtitle">
            Adjust individual score track levels, live pad synth volume, and metronome click
          </p>
        </div>
        <form method="dialog">
          <button
            type="submit"
            class="btn btn-icon"
            aria-label="Close Sound Settings"
            data-testid="close-sound-settings"
          >
            ✕
          </button>
        </form>
      </header>

      <div class="mixer-body">
        <section class="mixer-section" aria-labelledby="global-audio-heading">
          <h3 id="global-audio-heading" class="mixer-section-title">
            Global &amp; Practice Synth Channels
          </h3>

          <div class="mixer-row">
            <div class="mixer-channel-info">
              <label class="mixer-label" for="mixer-master-slider">
                Score Master Volume
              </label>
              <span class="mixer-sublabel">Overall alphaTab backing score output</span>
            </div>
            <div class="mixer-controls">
              <input
                id="mixer-master-slider"
                type="range"
                min="0"
                max="150"
                step="5"
                :value="masterVolumePercent"
                :aria-valuetext="`${masterVolumePercent}%`"
                :style="{ '--progress': `${(masterVolumePercent / 150) * 100}%` }"
                data-testid="mixer-master-volume"
                @input="(e) => onRangeInput(e, (v) => emit('updateMasterVolume', v))"
              />
              <span class="mixer-value" data-testid="mixer-master-value">
                {{ masterVolumePercent }}%
              </span>
            </div>
          </div>

          <div class="mixer-row">
            <div class="mixer-channel-info">
              <label class="mixer-label" for="mixer-pad-slider">
                Live Keyboard / Pad Synth
              </label>
              <span class="mixer-sublabel">Zero-latency drum audio when pressing keys or pads</span>
            </div>
            <div class="mixer-controls">
              <button
                type="button"
                class="btn btn-chip"
                :class="{ 'is-muted': !isPadAudioEnabled }"
                :aria-pressed="!isPadAudioEnabled"
                :aria-label="isPadAudioEnabled ? 'Mute live pad synth' : 'Unmute live pad synth'"
                data-testid="mixer-pad-mute"
                @click="emit('togglePadAudio')"
              >
                {{ isPadAudioEnabled ? 'M' : 'Muted' }}
              </button>
              <input
                id="mixer-pad-slider"
                type="range"
                min="0"
                max="150"
                step="5"
                :value="padVolumePercent"
                :disabled="!isPadAudioEnabled"
                :aria-valuetext="isPadAudioEnabled ? `${padVolumePercent}%` : 'Muted'"
                :style="{ '--progress': `${(padVolumePercent / 150) * 100}%` }"
                data-testid="mixer-pad-volume"
                @input="(e) => onRangeInput(e, (v) => emit('updatePadVolume', v))"
              />
              <span class="mixer-value" data-testid="mixer-pad-value">
                {{ isPadAudioEnabled ? `${padVolumePercent}%` : 'OFF' }}
              </span>
            </div>
          </div>

          <div class="mixer-row">
            <div class="mixer-channel-info">
              <label class="mixer-label" for="mixer-metronome-slider">
                Metronome Click
              </label>
              <span class="mixer-sublabel">Built-in score click track during playback</span>
            </div>
            <div class="mixer-controls">
              <input
                id="mixer-metronome-slider"
                type="range"
                min="0"
                max="150"
                step="5"
                :value="metronomeVolumePercent"
                :aria-valuetext="`${metronomeVolumePercent}%`"
                :style="{ '--progress': `${(metronomeVolumePercent / 150) * 100}%` }"
                data-testid="mixer-metronome-volume"
                @input="(e) => onRangeInput(e, (v) => emit('updateMetronomeVolume', v))"
              />
              <span class="mixer-value" data-testid="mixer-metronome-value">
                {{ metronomeVolumePercent === 0 ? 'OFF' : `${metronomeVolumePercent}%` }}
              </span>
            </div>
          </div>
        </section>

        <section class="mixer-section" aria-labelledby="score-tracks-heading">
          <div class="mixer-section-header">
            <h3 id="score-tracks-heading" class="mixer-section-title">
              Score Audio Tracks ({{ tracks.length }})
            </h3>
            <span class="mixer-section-hint">
              Tip: Mute or lower the drum track to hear only your own playing over the backing band
            </span>
          </div>

          <div
            v-for="track in tracks"
            :key="track.index"
            class="mixer-row track-row"
            :class="{
              'is-active-track': track.index === activeTrackIndex,
              'is-track-muted': track.isMuted,
            }"
            :data-testid="`mixer-track-row-${track.index}`"
          >
            <div class="mixer-channel-info">
              <div class="track-name-line">
                <label
                  class="mixer-label"
                  :for="`mixer-track-slider-${track.index}`"
                >
                  {{ track.index + 1 }}. {{ track.name }}
                </label>
                <span
                  class="track-type-badge"
                  :class="track.isPercussion ? 'badge-perc' : 'badge-melodic'"
                >
                  {{ track.isPercussion ? 'Percussion' : 'Melodic' }}
                </span>
                <span
                  v-if="track.index === activeTrackIndex"
                  class="track-viewed-badge"
                >
                  Shown in Tab
                </span>
              </div>
              <span class="mixer-sublabel">
                MIDI Channel {{ track.channelIndex + 1 }}
              </span>
            </div>

            <div class="mixer-controls">
              <button
                type="button"
                class="btn btn-chip"
                :class="{ 'is-muted': track.isMuted }"
                :aria-pressed="track.isMuted"
                :aria-label="`${track.isMuted ? 'Unmute' : 'Mute'} ${track.name}`"
                :data-testid="`mixer-track-mute-${track.index}`"
                @click="emit('toggleTrackMute', track.index)"
              >
                M
              </button>
              <button
                type="button"
                class="btn btn-chip"
                :class="{ 'is-solo': track.isSolo }"
                :aria-pressed="track.isSolo"
                :aria-label="`${track.isSolo ? 'Unsolo' : 'Solo'} ${track.name}`"
                :data-testid="`mixer-track-solo-${track.index}`"
                @click="emit('toggleTrackSolo', track.index)"
              >
                S
              </button>
              <input
                :id="`mixer-track-slider-${track.index}`"
                type="range"
                min="0"
                max="150"
                step="5"
                :value="track.volumePercent"
                :aria-valuetext="`${track.volumePercent}%`"
                :style="{ '--progress': `${(track.volumePercent / 150) * 100}%` }"
                :data-testid="`mixer-track-volume-${track.index}`"
                @input="(e) => onRangeInput(e, (v) => emit('updateTrackVolume', track.index, v))"
              />
              <span
                class="mixer-value"
                :data-testid="`mixer-track-value-${track.index}`"
              >
                {{ track.isMuted ? 'MUTED' : `${track.volumePercent}%` }}
              </span>
            </div>
          </div>
        </section>
      </div>

      <footer class="dialog-footer">
        <button
          type="button"
          class="btn"
          data-testid="mixer-reset-button"
          @click="emit('resetAll')"
        >
          ↺ Reset All Volumes
        </button>
        <form method="dialog">
          <button
            type="submit"
            class="btn btn-primary"
            data-testid="mixer-done-button"
          >
            Done
          </button>
        </form>
      </footer>
    </div>
  </dialog>
</template>
