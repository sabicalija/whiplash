<script setup lang="ts">
import { computed, onMounted, onBeforeUnmount, ref } from 'vue'
import TransportToolbar from './components/TransportToolbar.vue'
import ScoreViewport from './components/ScoreViewport.vue'
import TriggerBar from './components/TriggerBar.vue'
import { useAlphaTab } from './composables/useAlphaTab'
import { useInputBus } from './composables/useInputBus'
import { useKeyboardInput } from './composables/useKeyboardInput'
import { useDrumSynth } from './composables/useDrumSynth'
import type { KeyPadBinding, PracticeInputEvent } from './types/input'

const scoreViewportRef = ref<InstanceType<typeof ScoreViewport> | null>(null)
const alphaTabContainerRef = computed<HTMLElement | null>(
  () => scoreViewportRef.value?.viewportElement ?? null,
)

const player = useAlphaTab(alphaTabContainerRef)
const inputBus = useInputBus()
const keyboard = useKeyboardInput()
const drumSynth = useDrumSynth()

function handlePadTrigger(binding: KeyPadBinding): void {
  keyboard.triggerBinding(binding, 'virtual-pad', 110)
}

onMounted(() => {
  if (import.meta.env.DEV) {
    window.__TRAINER_DEBUG__ = {
      emitInput(partial?: Partial<PracticeInputEvent>): PracticeInputEvent {
        const event: PracticeInputEvent = {
          timestamp: partial?.timestamp ?? performance.now(),
          note: partial?.note ?? 38,
          velocity: partial?.velocity ?? 100,
          sourceId: partial?.sourceId ?? 'debug',
          rawCode: partial?.rawCode ?? 'KeyF',
          label: partial?.label ?? 'Debug Trigger',
        }
        return inputBus.emit(event)
      },
      getPlayerState() {
        return {
          isReady: player.isReady.value,
          isSoundFontLoaded: player.isSoundFontLoaded.value,
          isPlaying: player.isPlaying.value,
          isLooping: player.isLooping.value,
          tempoPercent: player.tempoPercent.value,
          currentTick: player.currentTick.value,
          currentTimeMs: player.currentTimeMs.value,
          activeTrackIndex: player.activeTrackIndex.value,
          trackCount: player.tracks.value.length,
          scoreTitle: player.scoreTitle.value,
        }
      },
      getRecentInputs() {
        return inputBus.recentEvents.value.map((ev) => ({ ...ev }))
      },
    }
  }
})

onBeforeUnmount(() => {
  if (import.meta.env.DEV && window.__TRAINER_DEBUG__) {
    delete window.__TRAINER_DEBUG__
  }
})
</script>

<template>
  <div
    class="whiplash-app"
    data-testid="whiplash-app"
    :data-player-ready="String(player.isReady.value)"
    :data-soundfont-loaded="String(player.isSoundFontLoaded.value)"
    :data-is-playing="String(player.isPlaying.value)"
    :data-is-looping="String(player.isLooping.value)"
    :data-tempo="player.tempoPercent.value"
    :data-active-track="player.activeTrackIndex.value"
    :data-last-note="inputBus.lastEvent.value?.note ?? ''"
    :data-input-count="inputBus.totalEventCount.value"
  >
    <TransportToolbar
      :is-ready="player.isReady.value"
      :is-player-ready="player.isPlayerReady.value"
      :is-sound-font-loaded="player.isSoundFontLoaded.value"
      :is-playing="player.isPlaying.value"
      :is-looping="player.isLooping.value"
      :tempo-percent="player.tempoPercent.value"
      :base-tempo-bpm="player.baseTempoBpm.value"
      :score-title="player.scoreTitle.value"
      :loaded-file-name="player.loadedFileName.value"
      :source-type="player.sourceType.value"
      :tracks="player.tracks.value"
      :active-track-index="player.activeTrackIndex.value"
      :current-tick="player.currentTick.value"
      :current-time-ms="player.currentTimeMs.value"
      @toggle-play-pause="player.togglePlayPause"
      @stop="player.stop"
      @toggle-loop="player.toggleLoop"
      @update-tempo="player.setTempoPercent"
      @select-track="player.selectTrack"
      @upload-file="player.loadGpFile"
      @reset-demo="player.loadDefaultScore"
    />

    <ScoreViewport
      ref="scoreViewportRef"
      :is-ready="player.isReady.value"
      :loaded-file-name="player.loadedFileName.value"
      :error-message="player.errorMessage.value"
      @file-dropped="player.loadGpFile"
    />

    <TriggerBar
      :bindings="keyboard.keyBindings.value"
      :active-codes="inputBus.activeCodes.value"
      :last-event="inputBus.lastEvent.value"
      :recent-events="inputBus.recentEvents.value"
      :total-event-count="inputBus.totalEventCount.value"
      :is-pad-audio-enabled="drumSynth.isAudioEnabled.value"
      @trigger-pad="handlePadTrigger"
      @clear-log="inputBus.clearHistory"
      @toggle-pad-audio="drumSynth.toggleAudio"
    />
  </div>
</template>
