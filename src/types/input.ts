import type {
  EvaluationStats,
  HitEvaluationResult,
  HitJudgment,
  TimingStatus,
} from './evaluation'

export interface PracticeInputEvent {
  /** High-resolution timestamp from performance.now() in milliseconds */
  timestamp: number
  /** Target MIDI note number (0-127, e.g., 36 = Kick, 38 = Snare) */
  note: number
  /** Normalized MIDI velocity (1-127) */
  velocity: number
  /** Adapter source identifier ('keyboard', 'virtual-pad', 'webmidi', 'debug') */
  sourceId: string
  /** Raw hardware/key code ('Space', 'KeyF', 'midi:ch10:38') */
  rawCode: string
  /** Human-readable drum or note name */
  label?: string
  /** Optional Phase 2 evaluation judgment if triggered during playback */
  judgment?: HitJudgment
  /** Optional Phase 2 timing status ('on-time', 'early', 'late', 'none') */
  timingStatus?: TimingStatus
  /** Optional Phase 2 timing offset in ms (negative = early, positive = late) */
  deltaMs?: number | null
}

export interface KeyPadBinding {
  /** KeyboardEvent.code value (e.g., 'Space', 'KeyF') */
  code: string
  /** Short keycap label for UI display */
  keyLabel: string
  /** Target General MIDI note number */
  note: number
  /** Instrument piece name */
  name: string
  /** Short category badge ('KICK', 'SNARE', 'HAT', 'TOM', 'CYM') */
  category: 'KICK' | 'SNARE' | 'HAT' | 'TOM' | 'CYM'
}

export type InputAdapterKind =
  | 'keyboard'
  | 'virtual-pad'
  | 'webmidi'
  | 'audio'
  | 'custom'

export interface InputAdapterDescriptor {
  /** Unique adapter identifier (e.g., 'keyboard', 'virtual-pad', 'webmidi') */
  id: string
  /** Human-readable adapter name */
  name: string
  /** Adapter category */
  kind: InputAdapterKind
  /** Whether the browser/device supports this adapter */
  isAvailable: boolean
  /** Whether hardware or listener is currently connected */
  isConnected: boolean
  /** Whether input from this adapter is active */
  isEnabled: boolean
}

export interface InstrumentProfile {
  /** Unique profile identifier (e.g., 'gm-standard-drums', 'roland-td27kv') */
  id: string
  /** Display name */
  name: string
  /** Whether profile targets percussion or melodic notes */
  isPercussion: boolean
  /** Ordered key/pad bindings for this profile */
  bindings: readonly KeyPadBinding[]
  /**
   * Optional multi-zone / alias map normalizing incoming raw MIDI notes
   * (e.g., Snare rimshot 40 -> Snare head 38, Hi-Hat pedal 44 -> Closed Hi-Hat 42)
   */
  midiAliases?: Readonly<Record<number, number>>
}

export interface PlayerDebugState {
  isReady: boolean
  isSoundFontLoaded: boolean
  isPlaying: boolean
  isLooping: boolean
  tempoPercent: number
  currentTick: number
  currentTimeMs: number
  activeTrackIndex: number
  trackCount: number
  scoreTitle: string
}

export interface TrainerDebugApi {
  emitInput: (partial?: Partial<PracticeInputEvent>) => PracticeInputEvent
  getPlayerState: () => PlayerDebugState
  getRecentInputs: () => PracticeInputEvent[]
  getEvaluationState: () => {
    stats: EvaluationStats
    lastResult: HitEvaluationResult | null
    targetNoteCount: number
  }
  resetEvaluation: () => void
}
