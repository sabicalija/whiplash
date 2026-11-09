<script setup lang="ts">
import { computed, onMounted, onBeforeUnmount, ref } from 'vue'
import TransportToolbar from './components/TransportToolbar.vue'
import HitEvaluationHud from './components/HitEvaluationHud.vue'
import ScoreViewport from './components/ScoreViewport.vue'
import TriggerBar from './components/TriggerBar.vue'
import SoundSettingsDialog from './components/SoundSettingsDialog.vue'
import { useAlphaTab } from './composables/useAlphaTab'
import { useInputBus } from './composables/useInputBus'
import { useKeyboardInput } from './composables/useKeyboardInput'
import { useDrumSynth } from './composables/useDrumSynth'
import { useHitEvaluation } from './composables/useHitEvaluation'
import type { KeyPadBinding, PracticeInputEvent } from './types/input'
import type { BarHitOverlayMarker } from './types/evaluation'

const scoreViewportRef = ref<InstanceType<typeof ScoreViewport> | null>(null)
const soundSettingsRef = ref<InstanceType<typeof SoundSettingsDialog> | null>(null)
const alphaTabContainerRef = computed<HTMLElement | null>(
  () => scoreViewportRef.value?.viewportElement ?? null,
)

const player = useAlphaTab(alphaTabContainerRef)
const inputBus = useInputBus()
const keyboard = useKeyboardInput()
const drumSynth = useDrumSynth()
const evaluation = useHitEvaluation({
  isPlaying: player.isPlaying,
  isLooping: player.isLooping,
  isFinished: player.isFinished,
  currentTick: player.currentTick,
  lastPositionPerfMs: player.lastPositionPerfMs,
  baseTempoBpm: player.baseTempoBpm,
  tempoPercent: player.tempoPercent,
  targetNotes: player.targetNotes,
})

const barHitMarkers = computed<BarHitOverlayMarker[]>(() => {
  void player.renderVersion.value
  const markers: BarHitOverlayMarker[] = []

  for (const res of evaluation.passResults.value) {
    if (!res.targetNoteId) {
      continue
    }
    const coords = player.resolveHitCoordinates(
      res.tick,
      res.midiNote,
      res.targetNoteId,
    )
    if (
      !coords ||
      coords.noteHeadX === undefined ||
      coords.noteHeadY === undefined
    ) {
      continue
    }

    markers.push({
      id: res.id,
      judgment: res.judgment,
      timingStatus: res.timingStatus,
      shortLabel: res.shortLabel,
      label: res.label,
      deltaMs: res.deltaMs,
      missReason: res.missReason,
      x: coords.noteHeadX,
      barTopY: coords.barTopY,
      stackIndex: 0,
      noteHeadX: coords.noteHeadX,
      noteHeadY: coords.noteHeadY,
    })
  }

  return markers
})

function handlePadTrigger(binding: KeyPadBinding): void {
  keyboard.triggerBinding(binding, 'virtual-pad', 110)
}

function openSoundSettings(): void {
  soundSettingsRef.value?.open()
}

function handleResetAllAudio(): void {
  player.resetAudioMix()
  drumSynth.setAudioEnabled(true)
  drumSynth.setVolumePercent(100)
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
      getEvaluationState() {
        return {
          stats: { ...evaluation.stats.value },
          lastResult: evaluation.lastResult.value
            ? { ...evaluation.lastResult.value }
            : null,
          targetNoteCount: player.targetNotes.value.length,
        }
      },
      resetEvaluation() {
        evaluation.resetStats()
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
      :is-finished="player.isFinished.value"
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
      @open-sound-settings="openSoundSettings"
    />

    <HitEvaluationHud
      :is-playing="player.isPlaying.value"
      :is-finished="player.isFinished.value"
      :stats="evaluation.stats.value"
      :last-result="evaluation.lastResult.value"
      :upcoming-notes="evaluation.upcomingNotes.value"
      @reset-stats="evaluation.resetStats"
    />

    <ScoreViewport
      ref="scoreViewportRef"
      :is-ready="player.isReady.value"
      :loaded-file-name="player.loadedFileName.value"
      :error-message="player.errorMessage.value"
      :bar-hit-markers="barHitMarkers"
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

    <SoundSettingsDialog
      ref="soundSettingsRef"
      :tracks="player.tracks.value"
      :active-track-index="player.activeTrackIndex.value"
      :master-volume-percent="player.masterVolumePercent.value"
      :metronome-volume-percent="player.metronomeVolumePercent.value"
      :pad-volume-percent="drumSynth.volumePercent.value"
      :is-pad-audio-enabled="drumSynth.isAudioEnabled.value"
      @update-master-volume="player.setMasterVolume"
      @update-metronome-volume="player.setMetronomeVolume"
      @update-pad-volume="drumSynth.setVolumePercent"
      @toggle-pad-audio="drumSynth.toggleAudio"
      @update-track-volume="(idx, vol) => player.setTrackVolume(idx, vol)"
      @toggle-track-mute="player.toggleTrackMute"
      @toggle-track-solo="player.toggleTrackSolo"
      @reset-all="handleResetAllAudio"
    />
  </div>
</template>
