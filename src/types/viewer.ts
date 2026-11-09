import type {
  BarHitOverlayMarker,
  HitEvaluationResult,
  ScoreBarMeta,
  TargetScoreNote,
} from './evaluation'

export interface ScoreViewerDescriptor {
  /** Unique viewer plugin identifier (e.g., 'alphatab-sheet', 'step-grid', 'highway') */
  id: string
  /** Display name in viewer selector */
  label: string
  /** Short badge label */
  shortLabel: string
  /** Brief description of the visualization mode */
  description: string
  /**
   * Whether this viewer renders on top of the `@coderline/alphatab` notation surface.
   * Alternative viewers (Canvas/SVG/DOM grids, falling-note highways) set this to `false`
   * and consume `bars`, `targetNotes`, `resultsByNoteId`, and `currentTick` directly.
   */
  usesAlphaTabSurface: boolean
}

/**
 * Engine-agnostic reactive session contract passed to any registered Score Viewer component.
 */
export interface ScoreViewerSessionProps {
  isReady: boolean
  loadedFileName: string
  errorMessage: string | null
  bars: readonly ScoreBarMeta[]
  targetNotes: readonly TargetScoreNote[]
  resultsByNoteId: Readonly<Record<string, HitEvaluationResult>>
  currentTick: number
  endTick: number
  isPlaying: boolean
  isFinished: boolean
  barHitMarkers: readonly BarHitOverlayMarker[]
}
