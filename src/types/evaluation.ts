export type HitJudgment = 'perfect' | 'good' | 'miss'

export type TimingStatus = 'on-time' | 'early' | 'late' | 'none'

export type MissReason =
  | 'wrong-note'
  | 'off-beat'
  | 'too-early'
  | 'too-late'
  | 'passed'

export interface ScoreBarMeta {
  /** 0-based bar index */
  index: number
  /** 1-based display bar number */
  number: number
  /** Absolute start tick of the bar */
  startTick: number
  /** Absolute end tick of the bar */
  endTick: number
  /** Duration of the bar in MIDI ticks */
  durationTicks: number
  /** Time signature numerator (e.g., 4 in 4/4) */
  timeSignatureNumerator: number
  /** Time signature denominator (e.g., 4 in 4/4) */
  timeSignatureDenominator: number
}

export interface TargetScoreNote {
  /** Unique identifier within the active track (`${barIndex}:${beatIndex}:${noteIndex}:${midiNote}`) */
  id: string
  /** Absolute MIDI tick start (`beat.absolutePlaybackStart`, 960 ticks per quarter note) */
  tick: number
  /** Beat playback duration in MIDI ticks (for non-tab viewers such as grids or highways) */
  durationTicks: number
  /** Target MIDI note number (`note.realValue`, e.g., 36 = Kick, 38 = Snare, 42 = Closed Hi-Hat) */
  midiNote: number
  /** 0-based bar index */
  barIndex: number
  /** 0-based beat index within bar */
  beatIndex: number
  /** Human-readable voice/note label (e.g., 'Kick Drum', 'Acoustic Snare', 'A1') */
  label: string
  /** Compact voice/note code (e.g., 'K', 'S', 'HH', 'A1') */
  shortLabel: string
  /** Optional mapped keyboard shortcut hint (e.g., 'Space', 'F', 'J') */
  keyHint?: string
}

export interface HitEvaluationResult {
  /** Unique result id */
  id: string
  /** Judgment tier */
  judgment: HitJudgment
  /** Timing classification relative to the beat ('on-time', 'early', 'late', or 'none') */
  timingStatus: TimingStatus
  /** Signed timing error in ms (negative = early, positive = late, null if passed/unmatched) */
  deltaMs: number | null
  /** Target or input MIDI note number */
  midiNote: number
  /** Human-readable note label */
  label: string
  /** Compact badge label for bar overlay (e.g., 'K', 'S', 'HH', 'A1') */
  shortLabel: string
  /** Tick position where evaluation occurred */
  tick: number
  /** Matched target note id if hit matched a score note */
  targetNoteId?: string
  /** Reason when judgment === 'miss' */
  missReason?: MissReason
  /** Expected note label if user played the wrong note on an active beat */
  expectedLabel?: string
  /** Timestamp (`performance.now()`) */
  timestamp: number
}

export interface BarHitOverlayMarker {
  id: string
  judgment: HitJudgment
  timingStatus: TimingStatus
  shortLabel: string
  label: string
  deltaMs: number | null
  missReason?: MissReason
  x: number
  barTopY: number
  stackIndex: number
  noteHeadX?: number
  noteHeadY?: number
}

export interface EvaluationStats {
  perfectCount: number
  goodCount: number
  missCount: number
  totalEvaluated: number
  currentStreak: number
  bestStreak: number
  /** Weighted accuracy percentage (0 - 100) */
  accuracyPercent: number
  /** Mean signed timing offset in ms across matched (Perfect/Good) hits */
  averageDeltaMs: number
}
