<script setup lang="ts">
import { computed } from 'vue'
import type {
  EvaluationStats,
  HitEvaluationResult,
  TargetScoreNote,
} from '../types/evaluation'

const props = defineProps<{
  isPlaying: boolean
  isFinished: boolean
  stats: EvaluationStats
  lastResult: HitEvaluationResult | null
  upcomingNotes: readonly TargetScoreNote[]
}>()

const emit = defineEmits<{
  resetStats: []
}>()

const judgmentLabel = computed<string>(() => {
  if (props.isFinished) {
    return 'HALTED'
  }
  if (!props.lastResult) {
    return props.isPlaying ? 'LISTENING' : 'FREE PLAY'
  }
  return props.lastResult.judgment.toUpperCase()
})

const judgmentDetail = computed<string>(() => {
  if (props.isFinished) {
    return 'Track finished · Review precision markings below or press Replay'
  }
  const res = props.lastResult
  if (!res) {
    return props.isPlaying
      ? 'Play along with the moving cursor'
      : 'Press Play to score timing & accuracy'
  }
  if (res.judgment === 'perfect' || res.judgment === 'good') {
    const delta = res.deltaMs ?? 0
    if (delta === 0) {
      return `${res.label} · 0ms (Dead-on)`
    }
    const sign = delta > 0 ? '+' : ''
    const dir = delta < 0 ? 'Early' : 'Late'
    return `${res.label} · ${sign}${delta}ms (${dir})`
  }
  if (res.missReason === 'passed') {
    return `Missed ${res.label} (Beat passed)`
  }
  if (res.missReason === 'wrong-note' && res.expectedLabel) {
    return `Hit ${res.label} (Expected ${res.expectedLabel})`
  }
  if (res.deltaMs !== null) {
    const sign = res.deltaMs > 0 ? '+' : ''
    return `Off-beat ${res.label} (${sign}${res.deltaMs}ms)`
  }
  return `Off-beat ${res.label}`
})

// Normalized 0% - 100% position for the timing offset indicator (-150ms .. +150ms -> 0% .. 100%, 50% = 0ms)
const meterPositionPercent = computed<number | null>(() => {
  const delta = props.lastResult?.deltaMs
  if (delta === null || delta === undefined) {
    return null
  }
  const clamped = Math.max(-150, Math.min(150, delta))
  return ((clamped + 150) / 300) * 100
})
</script>

<template>
  <section
    class="evaluation-hud"
    aria-label="Live Hit Timing and Accuracy HUD"
    data-testid="evaluation-hud"
    :data-last-judgment="lastResult?.judgment ?? 'none'"
    :data-accuracy="stats.accuracyPercent"
    :data-streak="stats.currentStreak"
    :data-perfect-count="stats.perfectCount"
    :data-good-count="stats.goodCount"
    :data-miss-count="stats.missCount"
  >
    <div class="hud-judgment-cluster" data-testid="hud-judgment-banner">
      <span
        class="judgment-badge"
        :class="lastResult ? `is-${lastResult.judgment}` : 'is-idle'"
        data-testid="hud-judgment-badge"
      >
        {{ judgmentLabel }}
      </span>
      <span class="judgment-detail" data-testid="hud-judgment-detail">
        {{ judgmentDetail }}
      </span>
    </div>

    <div
      class="hud-meter-cluster"
      aria-label="Timing Offset Gauge (Early vs Late)"
      data-testid="hud-timing-meter"
    >
      <span class="meter-bound">Early</span>
      <div class="meter-track">
        <div class="meter-zone-good" />
        <div class="meter-zone-perfect" />
        <div class="meter-center-line" />
        <div
          v-if="meterPositionPercent !== null && lastResult"
          class="meter-needle"
          :class="`is-${lastResult.judgment}`"
          :style="{ left: `${meterPositionPercent}%` }"
          data-testid="hud-meter-needle"
        />
      </div>
      <span class="meter-bound">Late</span>
    </div>

    <div
      v-if="upcomingNotes.length > 0"
      class="hud-upcoming-cluster"
      data-testid="hud-next-notes"
    >
      <span class="upcoming-label">Next:</span>
      <span
        v-for="note in upcomingNotes"
        :key="note.id"
        class="upcoming-chip"
      >
        <strong>{{ note.label }}</strong>
        <kbd v-if="note.keyHint" class="upcoming-kbd">{{ note.keyHint }}</kbd>
      </span>
    </div>

    <div class="hud-scoreboard" data-testid="hud-scoreboard">
      <div class="stat-pill">
        <span class="stat-label">Accuracy</span>
        <strong class="stat-value" data-testid="hud-accuracy">
          {{ stats.totalEvaluated > 0 ? `${stats.accuracyPercent}%` : '—' }}
        </strong>
      </div>

      <div class="stat-pill">
        <span class="stat-label">Streak</span>
        <strong class="stat-value" data-testid="hud-streak">
          {{ stats.currentStreak }}
          <small class="stat-sub">(Best {{ stats.bestStreak }})</small>
        </strong>
      </div>

      <div class="stat-counts" role="group" aria-label="Hit Breakdown">
        <span
          class="count-chip is-perfect"
          data-testid="hud-perfect-count"
        >
          Perfect: {{ stats.perfectCount }}
        </span>
        <span
          class="count-chip is-good"
          data-testid="hud-good-count"
        >
          Good: {{ stats.goodCount }}
        </span>
        <span
          class="count-chip is-miss"
          data-testid="hud-miss-count"
        >
          Miss: {{ stats.missCount }}
        </span>
      </div>

      <button
        v-if="stats.totalEvaluated > 0"
        type="button"
        class="btn btn-sm"
        data-testid="reset-evaluation-stats"
        @click="emit('resetStats')"
      >
        ↺ Reset Stats
      </button>
    </div>
  </section>
</template>
