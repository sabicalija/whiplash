import {
  shallowRef,
  markRaw,
  ref,
  readonly,
  onMounted,
  onBeforeUnmount,
  type Ref,
} from 'vue'
import * as alphaTab from '@coderline/alphatab'
import { DEFAULT_ALPHATEX_SCORE } from '../constants/defaultScore'

export interface TrackSummary {
  index: number
  name: string
  shortName: string
  isPercussion: boolean
  channelIndex: number
  volumePercent: number
  isMuted: boolean
  isSolo: boolean
}

/**
 * Core alphaTab composable (`useAlphaTab.ts`).
 *
 * INVARIANTS:
 * 1. `AlphaTabApi` and internal score/track models are NEVER wrapped in deep `ref()` or `reactive()`.
 *    We hold `AlphaTabApi` in a `shallowRef` wrapped with `markRaw()`.
 * 2. Instantiated strictly in `onMounted()` and destroyed via `api.destroy()` in `onBeforeUnmount()`.
 * 3. `core.fontDirectory` -> `${import.meta.env.BASE_URL}font/`
 *    `player.soundFont`   -> `${import.meta.env.BASE_URL}soundfont/sonivox.sf2`
 */
export function useAlphaTab(containerRef: Ref<HTMLElement | null>) {
  // Non-proxied AlphaTabApi instance
  const apiRef = shallowRef<alphaTab.AlphaTabApi | null>(null)
  let rawScore: alphaTab.model.Score | null = null

  // Reactive UI state synchronized from alphaTab events
  const isReady = ref<boolean>(false)
  const isPlayerReady = ref<boolean>(false)
  const isSoundFontLoaded = ref<boolean>(false)
  const isPlaying = ref<boolean>(false)
  const isLooping = ref<boolean>(false)
  const tempoPercent = ref<number>(100)
  const baseTempoBpm = ref<number>(110)
  const masterVolumePercent = ref<number>(100)
  const metronomeVolumePercent = ref<number>(0)
  const scoreTitle = ref<string>('Loading…')
  const scoreSubtitle = ref<string>('')
  const scoreArtist = ref<string>('')
  const sourceType = ref<'alphatex' | 'gp-file'>('alphatex')
  const loadedFileName = ref<string>('Built-in Demo (alphaTex)')
  const tracks = ref<TrackSummary[]>([])
  const activeTrackIndex = ref<number>(0)
  const currentTick = ref<number>(0)
  const currentTimeMs = ref<number>(0)
  const endTimeMs = ref<number>(0)
  const errorMessage = ref<string | null>(null)

  function extractTrackSummaries(score: alphaTab.model.Score): TrackSummary[] {
    return score.tracks.map((track, idx) => {
      const isPercussion =
        track.staves.some((staff) => staff.isPercussion) ||
        track.playbackInfo.primaryChannel === 9 ||
        track.playbackInfo.secondaryChannel === 9
      return {
        index: idx,
        name: track.name || `Track ${idx + 1}`,
        shortName: track.shortName || `T${idx + 1}`,
        isPercussion,
        channelIndex: track.playbackInfo.primaryChannel,
        volumePercent: 100,
        isMuted: Boolean(track.playbackInfo.isMute),
        isSolo: Boolean(track.playbackInfo.isSolo),
      }
    })
  }

  function syncAudioMixToEngine(): void {
    const api = apiRef.value
    if (!api) {
      return
    }
    api.masterVolume = masterVolumePercent.value / 100
    api.metronomeVolume = metronomeVolumePercent.value / 100

    if (!rawScore) {
      return
    }
    for (const summary of tracks.value) {
      const track = rawScore.tracks[summary.index]
      if (track) {
        const rawTrack = markRaw(track)
        api.changeTrackVolume([rawTrack], summary.volumePercent / 100)
        api.changeTrackMute([rawTrack], summary.isMuted)
        api.changeTrackSolo([rawTrack], summary.isSolo)
      }
    }
  }

  function loadDefaultScore(): void {
    const api = apiRef.value
    if (!api) {
      return
    }
    errorMessage.value = null
    isReady.value = false
    sourceType.value = 'alphatex'
    loadedFileName.value = 'Built-in Demo (alphaTex)'
    api.tex(DEFAULT_ALPHATEX_SCORE, [0])
  }

  async function loadGpFile(file: File): Promise<void> {
    const api = apiRef.value
    if (!api) {
      return
    }
    errorMessage.value = null
    isReady.value = false

    try {
      const buffer = await file.arrayBuffer()
      const bytes = new Uint8Array(buffer)
      sourceType.value = 'gp-file'
      loadedFileName.value = file.name
      const loaded = api.load(bytes, [0])
      if (!loaded) {
        errorMessage.value = `Unsupported or corrupted score file: "${file.name}"`
      }
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err)
      errorMessage.value = `Failed to read file "${file.name}": ${msg}`
    }
  }

  function selectTrack(trackIndex: number): void {
    const api = apiRef.value
    if (!api || !rawScore) {
      return
    }
    const targetTrack = rawScore.tracks[trackIndex]
    if (!targetTrack) {
      return
    }
    activeTrackIndex.value = trackIndex
    api.renderTracks([markRaw(targetTrack)])
  }

  function togglePlayPause(): void {
    const api = apiRef.value
    if (!api) {
      return
    }
    api.playPause()
  }

  function stop(): void {
    const api = apiRef.value
    if (!api) {
      return
    }
    api.stop()
    isPlaying.value = false
    currentTick.value = 0
    currentTimeMs.value = 0
  }

  function setLooping(enabled: boolean): void {
    const api = apiRef.value
    isLooping.value = enabled
    if (api) {
      api.isLooping = enabled
    }
  }

  function toggleLoop(): void {
    setLooping(!isLooping.value)
  }

  function setTempoPercent(percent: number): void {
    const clamped = Math.max(25, Math.min(200, Math.round(percent)))
    tempoPercent.value = clamped
    const api = apiRef.value
    if (api) {
      api.playbackSpeed = clamped / 100
    }
  }

  function setMasterVolume(percent: number): void {
    const clamped = Math.max(0, Math.min(150, Math.round(percent)))
    masterVolumePercent.value = clamped
    const api = apiRef.value
    if (api) {
      api.masterVolume = clamped / 100
    }
  }

  function setMetronomeVolume(percent: number): void {
    const clamped = Math.max(0, Math.min(150, Math.round(percent)))
    metronomeVolumePercent.value = clamped
    const api = apiRef.value
    if (api) {
      api.metronomeVolume = clamped / 100
    }
  }

  function setTrackVolume(trackIndex: number, percent: number): void {
    const clamped = Math.max(0, Math.min(150, Math.round(percent)))
    tracks.value = tracks.value.map((t) =>
      t.index === trackIndex ? { ...t, volumePercent: clamped } : t,
    )
    const api = apiRef.value
    const targetTrack = rawScore?.tracks[trackIndex]
    if (api && targetTrack) {
      api.changeTrackVolume([markRaw(targetTrack)], clamped / 100)
    }
  }

  function toggleTrackMute(trackIndex: number): void {
    const current = tracks.value.find((t) => t.index === trackIndex)
    if (!current) {
      return
    }
    const nextMuted = !current.isMuted
    tracks.value = tracks.value.map((t) =>
      t.index === trackIndex ? { ...t, isMuted: nextMuted } : t,
    )
    const api = apiRef.value
    const targetTrack = rawScore?.tracks[trackIndex]
    if (api && targetTrack) {
      api.changeTrackMute([markRaw(targetTrack)], nextMuted)
    }
  }

  function toggleTrackSolo(trackIndex: number): void {
    const current = tracks.value.find((t) => t.index === trackIndex)
    if (!current) {
      return
    }
    const nextSolo = !current.isSolo
    tracks.value = tracks.value.map((t) =>
      t.index === trackIndex ? { ...t, isSolo: nextSolo } : t,
    )
    const api = apiRef.value
    const targetTrack = rawScore?.tracks[trackIndex]
    if (api && targetTrack) {
      api.changeTrackSolo([markRaw(targetTrack)], nextSolo)
    }
  }

  function resetAudioMix(): void {
    setMasterVolume(100)
    setMetronomeVolume(0)
    tracks.value = tracks.value.map((t) => ({
      ...t,
      volumePercent: 100,
      isMuted: false,
      isSolo: false,
    }))
    syncAudioMixToEngine()
  }

  onMounted(() => {
    const el = containerRef.value
    if (!el) {
      return
    }

    const baseUrl = import.meta.env.BASE_URL || '/'
    const settings = new alphaTab.Settings()
    settings.core.fontDirectory = `${baseUrl}font/`
    settings.core.useWorkers = true
    settings.display.layoutMode = alphaTab.LayoutMode.Page
    settings.display.staveProfile = alphaTab.StaveProfile.Default
    settings.player.enablePlayer = true
    settings.player.enableCursor = true
    settings.player.enableUserInteraction = true
    settings.player.soundFont = `${baseUrl}soundfont/sonivox.sf2`

    const instance = markRaw(new alphaTab.AlphaTabApi(el, settings))
    apiRef.value = instance

    instance.scoreLoaded.on((score) => {
      rawScore = markRaw(score)
      scoreTitle.value = score.title || loadedFileName.value
      scoreSubtitle.value = score.subTitle || ''
      scoreArtist.value = score.artist || ''
      baseTempoBpm.value = score.tempo || 120
      tracks.value = extractTrackSummaries(score)

      const renderedTrackIdx = instance.tracks?.[0]?.index ?? 0
      activeTrackIndex.value = renderedTrackIdx
    })

    instance.renderFinished.on(() => {
      isReady.value = true
    })

    instance.soundFontLoaded.on(() => {
      isSoundFontLoaded.value = true
    })

    instance.playerReady.on(() => {
      isPlayerReady.value = true
      instance.isLooping = isLooping.value
      instance.playbackSpeed = tempoPercent.value / 100
      syncAudioMixToEngine()
    })

    instance.playerStateChanged.on((args) => {
      isPlaying.value = args.state === alphaTab.synth.PlayerState.Playing
    })

    instance.playerPositionChanged.on((args) => {
      currentTick.value = args.currentTick
      currentTimeMs.value = Math.round(args.currentTime)
      endTimeMs.value = Math.round(args.endTime)
    })

    instance.error.on((err) => {
      errorMessage.value = err?.message || 'An alphaTab rendering or playback error occurred.'
    })

    // Immediately load the built-in default percussion/bass score on startup
    loadDefaultScore()
  })

  onBeforeUnmount(() => {
    const api = apiRef.value
    if (api) {
      api.destroy()
      apiRef.value = null
    }
    rawScore = null
  })

  return {
    api: apiRef,
    isReady: readonly(isReady),
    isPlayerReady: readonly(isPlayerReady),
    isSoundFontLoaded: readonly(isSoundFontLoaded),
    isPlaying: readonly(isPlaying),
    isLooping: readonly(isLooping),
    tempoPercent: readonly(tempoPercent),
    baseTempoBpm: readonly(baseTempoBpm),
    masterVolumePercent: readonly(masterVolumePercent),
    metronomeVolumePercent: readonly(metronomeVolumePercent),
    scoreTitle: readonly(scoreTitle),
    scoreSubtitle: readonly(scoreSubtitle),
    scoreArtist: readonly(scoreArtist),
    sourceType: readonly(sourceType),
    loadedFileName: readonly(loadedFileName),
    tracks: readonly(tracks),
    activeTrackIndex: readonly(activeTrackIndex),
    currentTick: readonly(currentTick),
    currentTimeMs: readonly(currentTimeMs),
    endTimeMs: readonly(endTimeMs),
    errorMessage: readonly(errorMessage),
    loadDefaultScore,
    loadGpFile,
    selectTrack,
    togglePlayPause,
    stop,
    setLooping,
    toggleLoop,
    setTempoPercent,
    setMasterVolume,
    setMetronomeVolume,
    setTrackVolume,
    toggleTrackMute,
    toggleTrackSolo,
    resetAudioMix,
  }
}
