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
import type { ScoreBarMeta, TargetScoreNote } from '../types/evaluation'
import { useInstrumentProfile } from './useInstrumentProfile'

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
  const instrumentProfile = useInstrumentProfile()

  // Non-proxied AlphaTabApi instance
  const apiRef = shallowRef<alphaTab.AlphaTabApi | null>(null)
  let rawScore: alphaTab.model.Score | null = null

  // Reactive UI state synchronized from alphaTab events
  const isReady = ref<boolean>(false)
  const isPlayerReady = ref<boolean>(false)
  const isSoundFontLoaded = ref<boolean>(false)
  const isPlaying = ref<boolean>(false)
  const isFinished = ref<boolean>(false)
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
  const bars = ref<ScoreBarMeta[]>([])
  const targetNotes = ref<TargetScoreNote[]>([])
  const currentTick = ref<number>(0)
  const endTick = ref<number>(0)
  const currentTimeMs = ref<number>(0)
  const endTimeMs = ref<number>(0)
  const lastPositionPerfMs = ref<number>(0)
  const renderVersion = ref<number>(0)
  const errorMessage = ref<string | null>(null)
  let ignoringAutoStopReset = false

  function parkCursorAtEnd(): void {
    const api = apiRef.value as unknown as {
      _cursorUpdateTick?: (
        tick: number,
        stop: boolean,
        cursorSpeed: number,
        shouldScroll?: boolean,
        forceUpdate?: boolean,
      ) => void
    } | null
    if (!api) {
      return
    }
    const notes = targetNotes.value
    const lastNoteTick = notes.length > 0 ? notes[notes.length - 1]!.tick : 0
    const haltTick = Math.max(
      lastNoteTick,
      endTick.value > 0 ? endTick.value - 1 : 0,
    )
    window.requestAnimationFrame(() => {
      if (!isFinished.value) {
        return
      }
      api._cursorUpdateTick?.(haltTick, true, 1, false, true)
    })
  }

  function extractScoreBars(score: alphaTab.model.Score): ScoreBarMeta[] {
    return score.masterBars.map((mb, idx) => {
      const startTick = mb.start
      const durationTicks = mb.calculateDuration()
      return {
        index: idx,
        number: idx + 1,
        startTick,
        endTick: startTick + durationTicks,
        durationTicks,
        timeSignatureNumerator: mb.timeSignatureNumerator || 4,
        timeSignatureDenominator: mb.timeSignatureDenominator || 4,
      }
    })
  }

  function extractTrackTargetNotes(
    score: alphaTab.model.Score,
    trackIndex: number,
  ): TargetScoreNote[] {
    const track = score.tracks[trackIndex]
    if (!track) {
      return []
    }
    const isPercussion =
      track.staves.some((staff) => staff.isPercussion) ||
      track.playbackInfo.primaryChannel === 9 ||
      track.playbackInfo.secondaryChannel === 9

    const notes: TargetScoreNote[] = []
    const seenAtTick = new Set<string>()

    for (const staff of track.staves) {
      for (const bar of staff.bars) {
        for (const voice of bar.voices) {
          for (const beat of voice.beats) {
            if (beat.isRest || beat.notes.length === 0) {
              continue
            }
            const tick = beat.absolutePlaybackStart
            const durationTicks = Math.max(1, beat.playbackDuration)
            for (let nIdx = 0; nIdx < beat.notes.length; nIdx++) {
              const note = beat.notes[nIdx]
              if (!note || note.isTieDestination) {
                continue
              }
              const midiNote = note.realValue
              const dedupeKey = `${tick}:${midiNote}`
              if (seenAtTick.has(dedupeKey)) {
                continue
              }
              seenAtTick.add(dedupeKey)
              const info = instrumentProfile.getNoteInfo(midiNote, isPercussion)
              notes.push({
                id: `${bar.index}:${beat.index}:${nIdx}:${midiNote}`,
                tick,
                durationTicks,
                midiNote,
                barIndex: bar.index,
                beatIndex: beat.index,
                label: info.label,
                shortLabel: info.shortLabel,
                keyHint: info.keyHint,
              })
            }
          }
        }
      }
    }

    notes.sort((a, b) => a.tick - b.tick || a.midiNote - b.midiNote)
    return notes
  }

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
    targetNotes.value = extractTrackTargetNotes(rawScore, trackIndex)
    api.renderTracks([markRaw(targetTrack)])
  }

  function togglePlayPause(): void {
    const api = apiRef.value
    if (!api) {
      return
    }
    if (isFinished.value) {
      ignoringAutoStopReset = false
      isFinished.value = false
      currentTick.value = 0
      currentTimeMs.value = 0
      api.tickPosition = 0
      api.play()
      return
    }
    api.playPause()
  }

  function stop(): void {
    const api = apiRef.value
    if (!api) {
      return
    }
    if (isPlaying.value) {
      // Halt playback in place so the user can analyze their hits on the score
      api.pause()
      isPlaying.value = false
      return
    }
    // When already halted/paused, rewind cursor to the beginning of the score
    ignoringAutoStopReset = false
    isFinished.value = false
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

  function resolveHitCoordinates(
    tick: number,
    midiNote: number,
    targetNoteId?: string,
  ): {
    x: number
    barTopY: number
    noteHeadX?: number
    noteHeadY?: number
  } | null {
    const api = apiRef.value
    const lookup = api?.boundsLookup
    if (!lookup || !rawScore) {
      return null
    }
    const track = rawScore.tracks[activeTrackIndex.value]
    if (!track) {
      return null
    }

    let matchedBeat: alphaTab.model.Beat | null = null
    let closestBeat: alphaTab.model.Beat | null = null
    let closestTickDist = Infinity

    let expectedBarIdx = -1
    let expectedBeatIdx = -1
    if (targetNoteId) {
      const parts = targetNoteId.split(':')
      expectedBarIdx = Number(parts[0])
      expectedBeatIdx = Number(parts[1])
    }

    for (const staff of track.staves) {
      for (const bar of staff.bars) {
        for (const voice of bar.voices) {
          for (const beat of voice.beats) {
            if (beat.isRest && beat.notes.length === 0) {
              continue
            }
            if (
              expectedBarIdx >= 0 &&
              bar.index === expectedBarIdx &&
              beat.index === expectedBeatIdx
            ) {
              matchedBeat = beat
              break
            }
            const start = beat.absolutePlaybackStart
            const dur = Math.max(1, beat.playbackDuration)
            if (tick >= start && tick < start + dur) {
              if (!closestBeat) {
                closestBeat = beat
                closestTickDist = 0
              }
            } else {
              const dist = Math.abs(tick - start)
              if (dist < closestTickDist) {
                closestTickDist = dist
                closestBeat = beat
              }
            }
          }
          if (matchedBeat) break
        }
        if (matchedBeat) break
      }
      if (matchedBeat) break
    }

    const targetBeat = matchedBeat ?? closestBeat
    if (!targetBeat) {
      return null
    }

    const beatBounds = lookup.findBeat(targetBeat)
    if (!beatBounds) {
      return null
    }

    const masterBarBounds = beatBounds.barBounds.masterBarBounds
    const barVisual = masterBarBounds.visualBounds

    if (matchedBeat) {
      let noteHeadX: number | undefined
      let noteHeadY: number | undefined
      if (beatBounds.notes) {
        for (const nb of beatBounds.notes) {
          if (nb.note.realValue === midiNote && nb.noteHeadBounds) {
            noteHeadX = Math.round(nb.noteHeadBounds.x + nb.noteHeadBounds.w / 2)
            noteHeadY = Math.round(nb.noteHeadBounds.y + nb.noteHeadBounds.h / 2)
            break
          }
        }
      }
      return {
        x: Math.round(beatBounds.onNotesX),
        barTopY: Math.round(barVisual.y),
        noteHeadX,
        noteHeadY,
      }
    }

    // Interpolate X position within the beat for off-beat or wrong-note hits
    let nextBeatX = beatBounds.realBounds.x + beatBounds.realBounds.w
    if (targetBeat.nextBeat) {
      const nextBounds = lookup.findBeat(targetBeat.nextBeat)
      if (
        nextBounds &&
        nextBounds.barBounds.masterBarBounds.staffSystemBounds ===
          masterBarBounds.staffSystemBounds
      ) {
        nextBeatX = nextBounds.onNotesX
      }
    }

    const beatStart = targetBeat.absolutePlaybackStart
    const beatDur = Math.max(1, targetBeat.playbackDuration)
    const ratio = Math.max(0, Math.min(1, (tick - beatStart) / beatDur))
    const interpolatedX = beatBounds.onNotesX + (nextBeatX - beatBounds.onNotesX) * ratio

    return {
      x: Math.round(interpolatedX),
      barTopY: Math.round(barVisual.y),
    }
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
    settings.core.includeNoteBounds = true
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
      ignoringAutoStopReset = false
      isFinished.value = false
      scoreTitle.value = score.title || loadedFileName.value
      scoreSubtitle.value = score.subTitle || ''
      scoreArtist.value = score.artist || ''
      baseTempoBpm.value = score.tempo || 120
      tracks.value = extractTrackSummaries(score)
      bars.value = extractScoreBars(score)

      const renderedTrackIdx = instance.tracks?.[0]?.index ?? 0
      activeTrackIndex.value = renderedTrackIdx
      targetNotes.value = extractTrackTargetNotes(score, renderedTrackIdx)
    })

    instance.renderFinished.on(() => {
      isReady.value = true
      renderVersion.value += 1
    })

    instance.postRenderFinished.on(() => {
      renderVersion.value += 1
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

    instance.playerFinished.on(() => {
      if (!isLooping.value) {
        ignoringAutoStopReset = true
        isPlaying.value = false
        isFinished.value = true
        if (endTick.value > 0) {
          currentTick.value = endTick.value
        }
        if (endTimeMs.value > 0) {
          currentTimeMs.value = endTimeMs.value
        }
        parkCursorAtEnd()
      }
    })

    instance.playerStateChanged.on((args) => {
      if (
        ignoringAutoStopReset &&
        args.state === alphaTab.synth.PlayerState.Paused
      ) {
        ignoringAutoStopReset = false
        isPlaying.value = false
        isFinished.value = true
        parkCursorAtEnd()
        return
      }
      isPlaying.value = args.state === alphaTab.synth.PlayerState.Playing
      if (isPlaying.value) {
        isFinished.value = false
      }
    })

    instance.playerPositionChanged.on((args) => {
      if (ignoringAutoStopReset && args.currentTick === 0) {
        parkCursorAtEnd()
        return
      }
      if (isFinished.value && !ignoringAutoStopReset && args.isSeek) {
        isFinished.value = false
      }
      currentTick.value = args.currentTick
      currentTimeMs.value = Math.round(args.currentTime)
      endTimeMs.value = Math.round(args.endTime)
      if (args.endTick > 0) {
        endTick.value = args.endTick
      }
      lastPositionPerfMs.value = performance.now()
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
    isFinished: readonly(isFinished),
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
    bars: readonly(bars),
    targetNotes: readonly(targetNotes),
    currentTick: readonly(currentTick),
    endTick: readonly(endTick),
    currentTimeMs: readonly(currentTimeMs),
    endTimeMs: readonly(endTimeMs),
    lastPositionPerfMs: readonly(lastPositionPerfMs),
    renderVersion: readonly(renderVersion),
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
    resolveHitCoordinates,
  }
}
