import {
  computed,
  onMounted,
  onBeforeUnmount,
  readonly,
  ref,
  watch,
  type Ref,
} from 'vue'
import { getMidiNoteInfo } from '../constants/defaultKeyMap'
import type {
  EvaluationStats,
  HitEvaluationResult,
  HitJudgment,
  TargetScoreNote,
  TimingStatus,
} from '../types/evaluation'
import type { PracticeInputEvent } from '../types/input'
import { useInputBus } from './useInputBus'

export const QUARTER_NOTE_TICKS = 960
export const PERFECT_WINDOW_MS = 55
export const GOOD_WINDOW_MS = 150
export const MAX_MATCH_WINDOW_MS = 150
export const PASS_MISS_THRESHOLD_MS = 155

export interface HitEvaluationContext {
  isPlaying: Readonly<Ref<boolean>>
  isLooping: Readonly<Ref<boolean>>
  isFinished: Readonly<Ref<boolean>>
  currentTick: Readonly<Ref<number>>
  lastPositionPerfMs: Readonly<Ref<number>>
  baseTempoBpm: Readonly<Ref<number>>
  tempoPercent: Readonly<Ref<number>>
  targetNotes: Readonly<Ref<readonly TargetScoreNote[]>>
}

/**
 * Phase 2 Timing & Hit Evaluation Engine (`useHitEvaluation.ts`).
 *
 * Subscribes to `useInputBus` and compares incoming `PracticeInputEvent` timestamps/ticks
 * against the active `alphaTab` track's `TargetScoreNote` timeline.
 */
export function useHitEvaluation(ctx: HitEvaluationContext) {
  const inputBus = useInputBus()

  const perfectCount = ref<number>(0)
  const goodCount = ref<number>(0)
  const missCount = ref<number>(0)
  const currentStreak = ref<number>(0)
  const bestStreak = ref<number>(0)
  const lastResult = ref<HitEvaluationResult | null>(null)
  const recentResults = ref<HitEvaluationResult[]>([])
  const passResults = ref<HitEvaluationResult[]>([])

  // Plain Set/variables for internal tracking (no need for deep proxy overhead)
  const evaluatedNoteIds = new Set<string>()
  let resultSeq = 0
  let matchedDeltaSumMs = 0
  let matchedHitCount = 0
  let previousTick = 0
  let playbackStartTick = 0
  let unsubscribeInput: (() => void) | null = null

  const effectiveBpm = computed<number>(() => {
    const bpm = (ctx.baseTempoBpm.value * ctx.tempoPercent.value) / 100
    return Math.max(15, bpm)
  })

  const msPerQuarterNote = computed<number>(() => 60000 / effectiveBpm.value)

  function ticksToMs(ticks: number): number {
    return (ticks / QUARTER_NOTE_TICKS) * msPerQuarterNote.value
  }

  function msToTicks(ms: number): number {
    return (ms / msPerQuarterNote.value) * QUARTER_NOTE_TICKS
  }

  function getInterpolatedTick(eventTimestamp: number): number {
    if (!ctx.isPlaying.value || ctx.lastPositionPerfMs.value <= 0) {
      return ctx.currentTick.value
    }
    const elapsedMs = Math.max(
      0,
      Math.min(35, eventTimestamp - ctx.lastPositionPerfMs.value),
    )
    return ctx.currentTick.value + msToTicks(elapsedMs)
  }

  function recordResult(
    partial: Omit<HitEvaluationResult, 'id' | 'shortLabel'>,
  ): HitEvaluationResult {
    resultSeq += 1
    const info = getMidiNoteInfo(partial.midiNote, true)
    const result: HitEvaluationResult = {
      ...partial,
      id: `eval-${resultSeq}`,
      shortLabel: info.shortLabel,
    }
    lastResult.value = result
    recentResults.value = [result, ...recentResults.value.slice(0, 19)]
    passResults.value = [...passResults.value, result]

    if (result.judgment === 'perfect') {
      perfectCount.value += 1
      currentStreak.value += 1
      if (currentStreak.value > bestStreak.value) {
        bestStreak.value = currentStreak.value
      }
      if (result.deltaMs !== null) {
        matchedDeltaSumMs += result.deltaMs
        matchedHitCount += 1
      }
    } else if (result.judgment === 'good') {
      goodCount.value += 1
      currentStreak.value += 1
      if (currentStreak.value > bestStreak.value) {
        bestStreak.value = currentStreak.value
      }
      if (result.deltaMs !== null) {
        matchedDeltaSumMs += result.deltaMs
        matchedHitCount += 1
      }
    } else {
      missCount.value += 1
      currentStreak.value = 0
    }

    return result
  }

  function evaluateInputEvent(event: PracticeInputEvent): HitEvaluationResult | null {
    // Allow free practice when playback is stopped/paused (unless invoked via debug API)
    if (!ctx.isPlaying.value && event.sourceId !== 'debug') {
      return null
    }

    const activeTick = getInterpolatedTick(event.timestamp)
    const notes = ctx.targetNotes.value
    const noteInfo = getMidiNoteInfo(event.note, true)
    const eventLabel = event.label ?? noteInfo.label

    let bestCandidate: TargetScoreNote | null = null
    let bestDeltaMs = Infinity

    for (const target of notes) {
      if (evaluatedNoteIds.has(target.id)) {
        continue
      }
      if (target.midiNote !== event.note) {
        continue
      }
      const deltaMs = ticksToMs(activeTick - target.tick)
      if (Math.abs(deltaMs) <= MAX_MATCH_WINDOW_MS) {
        if (Math.abs(deltaMs) < Math.abs(bestDeltaMs)) {
          bestCandidate = target
          bestDeltaMs = deltaMs
        }
      }
    }

    if (bestCandidate) {
      evaluatedNoteIds.add(bestCandidate.id)
      const roundedDelta = Math.round(bestDeltaMs)
      const absDelta = Math.abs(roundedDelta)

      let judgment: HitJudgment = 'miss'
      let timingStatus: TimingStatus = 'on-time'

      if (absDelta <= PERFECT_WINDOW_MS) {
        judgment = 'perfect'
        timingStatus = 'on-time'
      } else if (absDelta <= GOOD_WINDOW_MS) {
        judgment = 'good'
        timingStatus = roundedDelta < 0 ? 'early' : 'late'
      } else {
        judgment = 'miss'
        timingStatus = roundedDelta < 0 ? 'early' : 'late'
      }

      const result = recordResult({
        judgment,
        timingStatus,
        deltaMs: roundedDelta,
        midiNote: event.note,
        label: bestCandidate.label,
        tick: bestCandidate.tick,
        targetNoteId: bestCandidate.id,
        missReason:
          judgment === 'miss'
            ? roundedDelta < 0
              ? 'too-early'
              : 'too-late'
            : undefined,
        timestamp: event.timestamp,
      })
      inputBus.annotateLastEvent(result.judgment, result.deltaMs, result.timingStatus)
      return result
    }

    // No matching target note for this MIDI number inside the window.
    // Check if another target note was expected at this exact beat window.
    let expectedOther: TargetScoreNote | null = null
    for (const target of notes) {
      if (evaluatedNoteIds.has(target.id)) {
        continue
      }
      const deltaMs = ticksToMs(activeTick - target.tick)
      if (Math.abs(deltaMs) <= GOOD_WINDOW_MS) {
        expectedOther = target
        break
      }
    }

    const result = recordResult({
      judgment: 'miss',
      timingStatus: 'none',
      deltaMs: null,
      midiNote: event.note,
      label: eventLabel,
      tick: Math.round(activeTick),
      missReason: expectedOther ? 'wrong-note' : 'off-beat',
      expectedLabel: expectedOther?.label,
      timestamp: event.timestamp,
    })
    inputBus.annotateLastEvent(result.judgment, result.deltaMs, result.timingStatus)
    return result
  }

  // Watch playback tick progression to detect loop wraps and passed (unplayed) notes
  watch(
    () => ctx.currentTick.value,
    (newTick) => {
      if (!ctx.isPlaying.value) {
        previousTick = newTick
        playbackStartTick = newTick
        return
      }

      // Detect loop wrap-around during active looping playback
      if (
        ctx.isLooping.value &&
        previousTick > QUARTER_NOTE_TICKS &&
        newTick < previousTick - QUARTER_NOTE_TICKS
      ) {
        evaluatedNoteIds.clear()
        passResults.value = []
        playbackStartTick = newTick
        previousTick = newTick
        return
      }

      const notes = ctx.targetNotes.value
      const now = performance.now()

      for (const target of notes) {
        if (evaluatedNoteIds.has(target.id)) {
          continue
        }
        if (target.tick < playbackStartTick) {
          evaluatedNoteIds.add(target.id)
          continue
        }
        const lateMs = ticksToMs(newTick - target.tick)
        if (lateMs > PASS_MISS_THRESHOLD_MS) {
          evaluatedNoteIds.add(target.id)
          recordResult({
            judgment: 'miss',
            timingStatus: 'none',
            deltaMs: null,
            midiNote: target.midiNote,
            label: target.label,
            tick: target.tick,
            targetNoteId: target.id,
            missReason: 'passed',
            timestamp: now,
          })
        } else if (target.tick > newTick) {
          // Since targetNotes is sorted by tick, we can stop scanning ahead
          break
        }
      }

      previousTick = newTick
    },
  )

  // When playback finishes and halts at the end of the track, finalize any remaining unplayed notes
  // while keeping all over-the-bar precision markings (`passResults`) intact for user analysis.
  watch(
    () => ctx.isFinished.value,
    (finished) => {
      if (!finished) {
        return
      }
      const notes = ctx.targetNotes.value
      const now = performance.now()
      for (const target of notes) {
        if (evaluatedNoteIds.has(target.id)) {
          continue
        }
        if (target.tick < playbackStartTick) {
          evaluatedNoteIds.add(target.id)
          continue
        }
        evaluatedNoteIds.add(target.id)
        recordResult({
          judgment: 'miss',
          timingStatus: 'none',
          deltaMs: null,
          midiNote: target.midiNote,
          label: target.label,
          tick: target.tick,
          targetNoteId: target.id,
          missReason: 'passed',
          timestamp: now,
        })
      }
    },
  )

  // Clear per-pass note locks & markings only when starting a new playback pass from the beginning
  watch(
    () => ctx.isPlaying.value,
    (playing) => {
      if (playing) {
        playbackStartTick = ctx.currentTick.value
        previousTick = ctx.currentTick.value
        if (ctx.currentTick.value <= QUARTER_NOTE_TICKS / 4) {
          evaluatedNoteIds.clear()
          passResults.value = []
        }
      }
    },
  )

  watch(
    () => ctx.targetNotes.value,
    () => {
      resetStats()
    },
  )

  const stats = computed<EvaluationStats>(() => {
    const total = perfectCount.value + goodCount.value + missCount.value
    const weightedPoints = perfectCount.value * 1.0 + goodCount.value * 0.65
    const accuracyPercent =
      total > 0 ? Math.round((weightedPoints / total) * 100) : 100
    const averageDeltaMs =
      matchedHitCount > 0 ? Math.round(matchedDeltaSumMs / matchedHitCount) : 0

    return {
      perfectCount: perfectCount.value,
      goodCount: goodCount.value,
      missCount: missCount.value,
      totalEvaluated: total,
      currentStreak: currentStreak.value,
      bestStreak: bestStreak.value,
      accuracyPercent,
      averageDeltaMs,
    }
  })

  const upcomingNotes = computed<readonly TargetScoreNote[]>(() => {
    void lastResult.value
    const notes = ctx.targetNotes.value
    if (notes.length === 0) {
      return []
    }
    const tick = ctx.currentTick.value
    let nextBeatTick: number | null = null
    const group: TargetScoreNote[] = []

    for (const target of notes) {
      if (evaluatedNoteIds.has(target.id) && ctx.isPlaying.value) {
        continue
      }
      if (target.tick >= tick - QUARTER_NOTE_TICKS / 8) {
        if (nextBeatTick === null) {
          nextBeatTick = target.tick
        }
        if (target.tick === nextBeatTick) {
          group.push(target)
        } else {
          break
        }
      }
    }

    return group.length > 0 ? group : notes.slice(0, 1)
  })

  function resetStats(): void {
    perfectCount.value = 0
    goodCount.value = 0
    missCount.value = 0
    currentStreak.value = 0
    bestStreak.value = 0
    lastResult.value = null
    recentResults.value = []
    passResults.value = []
    matchedDeltaSumMs = 0
    matchedHitCount = 0
    evaluatedNoteIds.clear()
    playbackStartTick = ctx.currentTick.value
    previousTick = ctx.currentTick.value
  }

  onMounted(() => {
    unsubscribeInput = inputBus.onInput((event) => {
      evaluateInputEvent(event)
    })
  })

  onBeforeUnmount(() => {
    if (unsubscribeInput) {
      unsubscribeInput()
      unsubscribeInput = null
    }
  })

  return {
    stats,
    lastResult: readonly(lastResult),
    recentResults: readonly(recentResults),
    passResults: readonly(passResults),
    upcomingNotes,
    evaluateInputEvent,
    resetStats,
  }
}
