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
}
