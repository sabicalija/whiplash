# Architectural Decision Records (DECISIONS.md)

This document tracks architectural decisions, file structure evolutions, and engineering trade-offs across the progressive development phases of **Whiplash**.

---

## ADR-001: Vue 3 + `@coderline/alphatab` Reactivity Boundary & Instrument-Agnostic Input Bus
- **Date:** 2026-11-08
- **Status:** Accepted
- **Phase:** Bootstrap (Step 1)

### Context
Whiplash is a browser-based Music & Percussion Practice Trainer designed to render interactive Guitar Pro (`.gp3`–`.gp8`) and `alphaTex` scores with real-time audio synthesis and evaluate user timing across diverse input devices (PC keyboards first, followed by generic USB-MIDI controllers and multi-zone electronic drum kits such as the Roland TD-27KV).

Two primary architectural risks exist when building this system:
1. **Vue 3 Proxy Incompatibility with Complex Web APIs:** `@coderline/alphatab` manages internal Web Workers, `AudioContext` / `AudioWorklet` nodes, and DOM mutation observers. Wrapping `AlphaTabApi` (or future WebMIDI `MIDIInput` objects) in Vue 3's deep `ref()` or `reactive()` proxies causes runtime failures due to proxied private class fields and cloned worker messages.
2. **Hardware Coupling:** If the score evaluation engine directly listens to `KeyboardEvent` or raw MIDI bytes, adding multi-zone e-drum presets or melodic instruments later would require rewriting core evaluation logic.

### Decision
1. **Strict Reactivity Boundary for Engine & Hardware Instances:**
   - `AlphaTabApi`, audio nodes, and future `MIDIInput` references must never be wrapped in deep Vue proxies. They must be held in `shallowRef()` or marked with `markRaw()`, with lifecycle strictly bound to `onMounted()` and `onBeforeUnmount()` (`api.destroy()`).
   - Static font and soundfont assets are served via `@coderline/alphatab-vite` at `${import.meta.env.BASE_URL}font/` and `${import.meta.env.BASE_URL}soundfont/sonivox.sf2`.
2. **Unified `PracticeInputEvent` & Shared Input Bus (`useInputBus.ts`):**
   - All hardware adapters (`KeyboardInputAdapter` in Phase 1, `WebMidiInputAdapter` in Phase 3) normalize raw device signals into a single `PracticeInputEvent` structure (`timestamp`, `note`, `velocity`, `sourceId`, `rawCode`) and publish to `useInputBus.ts`.
3. **Deterministic Browser Agent Observability:**
   - Interactive controls expose `data-testid` and reactive `data-*` state attributes, and `window.__TRAINER_DEBUG__` is exposed in development builds so automated browser tests can trigger synthetic notes and inspect `alphaTab` tick/playback state without requiring physical audio or MIDI hardware.

### Consequences
- **Positive:** Downstream timing evaluation (Phase 2), MIDI Learn (Phase 3), and multi-zone e-drum normalization (Phase 4) can subscribe to `useInputBus.ts` with zero changes to the player or UI shell.
- **Positive:** Eliminates subtle Vue proxy bugs with `AlphaTabApi` workers and synthesizer state.
- **Trade-off:** Reactive UI state (such as `isPlaying`, `currentTick`, `activeTrackIndex`, and `tracks`) must be explicitly synchronized via `alphaTab` event listeners inside `useAlphaTab.ts` rather than binding directly to deep properties of the `AlphaTabApi` object.

---

## ADR-002: Phase 1 Implementation — Core alphaTab Player, Multi-Track alphaTex Etude & Keyboard Input Adapter
- **Date:** 2026-11-08
- **Status:** Accepted
- **Phase:** Phase 1 (Core Player + Keyboard Input)

### Context
Phase 1 required scaffolding the Vite + Vue 3 + TypeScript project with `@coderline/alphatab` and `@coderline/alphatab-vite`, building the core notation/audio player (`useAlphaTab.ts`), and wiring the hardware-agnostic input bus (`useInputBus.ts`) to a desktop `KeyboardInputAdapter` (`useKeyboardInput.ts`) and on-screen `TriggerBar.vue`.

### Key Decisions & File Structure Changes
1. **Added Phase 1 File Tree:**
   - `vite.config.ts`: Configured `@vitejs/plugin-vue` and `alphaTab()` from `@coderline/alphatab-vite` (v1.9.0) to serve web workers, Bravura fonts (`font/`), and the Sonivox soundfont (`soundfont/sonivox.sf2`).
   - `src/types/input.ts` & `src/vite-env.d.ts`: Defined `PracticeInputEvent`, `KeyPadBinding`, `PlayerDebugState`, and `window.__TRAINER_DEBUG__`.
   - `src/constants/defaultScore.ts`: Authored a built-in two-track `alphaTex` 1.9 score (`Studio Drum Kit` percussion track + `Electric Finger Bass` melodic track). Using alphaTex 1.9's `:8` / `:16` / `:4` duration range syntax ensures percussion articulation numbers (`36`, `38`, `42`, `47`, `49`, `50`, `51`) are parsed as `Articulation` notes on `\instrument ("percussion")` staves rather than `fret.string` pairs.
   - `src/constants/defaultKeyMap.ts`: Mapped ergonomic home-row keys + Spacebar (`Space` -> 36 Kick, `KeyS` -> 49 Crash, `KeyD` -> 50 High Tom, `KeyF` -> 38 Snare, `KeyJ` -> 42 Closed Hi-Hat, `KeyK` -> 47 Low-Mid Tom, `KeyL` -> 51 Ride) to standard GM percussion MIDI notes.
   - `src/composables/useAlphaTab.ts`, `src/composables/useInputBus.ts`, `src/composables/useKeyboardInput.ts`: Implemented the non-proxied `AlphaTabApi` wrapper, singleton event bus, and keyboard listener with key-repeat and form-focus guards.
   - `src/components/TransportToolbar.vue`, `src/components/ScoreViewport.vue`, `src/components/TriggerBar.vue`: Built the responsive studio UI with drag-and-drop `.gp3`–`.gp8` loading, track selector, transport/tempo controls, trigger pads, and live event stream.
2. **Debug Serialization Safety:**
   - `window.__TRAINER_DEBUG__.getRecentInputs()` clones each `PracticeInputEvent` (`{ ...ev }`) so external CDP/browser inspectors receive plain objects rather than Vue `readonly()` proxies.

### Known Trade-offs
- In Phase 1, keyboard/pad triggers emit normalized `PracticeInputEvent` telemetry and visual flashes without scoring accuracy against the score cursor; hit timing windows and accuracy evaluation are deferred to **Phase 2**.

---

## ADR-003: Version Control Discipline — Modular Conventional Commits, SemVer & Generated Asset Exclusions
- **Date:** 2026-11-09
- **Status:** Accepted
- **Phase:** Phase 1 (Repository Initialization & Governance)

### Context
As the repository is initialized and connected to its remote (`origin`), clear version control and release standards are required so human developers and AI agents maintain a clean, bisectable commit history without committing generated build artifacts.

### Decision
1. **Conventional Commits 1.0.0 & Modular Commit Granularity:**
   - All commits must adhere to the Conventional Commits v1.0.0 specification (`<type>(<scope>): <summary>`).
   - Changes must be split into modular, self-contained commits by logical layer (`build`, `feat(input)`, `feat(player)`, `feat(ui)`, `docs`) rather than monolithic bulk commits.
2. **Semantic Versioning 2.0.0:**
   - Releases follow SemVer (`MAJOR.MINOR.PATCH`) aligned with `package.json` (`0.1.0` for Phase 1 completion).
3. **Generated Asset Hygiene in `.gitignore`:**
   - `@coderline/alphatab-vite` automatically copies `font/` and `soundfont/` (~5.9 MB) from `node_modules/@coderline/alphatab/dist/` into `public/` on `buildStart`, and `vue-tsc -b` emits `*.tsbuildinfo`. Both are excluded in `.gitignore` to keep the repository lightweight and prevent noisy diffs across dependency upgrades.

### Consequences
- **Positive:** Clean, readable git log suitable for automated changelog generation and `git bisect`.
- **Positive:** Prevents ~6 MB of redundant binary soundfont/font files from bloating git history while preserving zero-config asset serving via `@coderline/alphatab-vite`.

---

## ADR-004: Zero-Latency Web Audio API Drum Synthesizer for Live Input (`useDrumSynth.ts`)
- **Date:** 2026-11-09
- **Status:** Accepted
- **Phase:** Phase 1 Refinement (Live Input Audio & Demo Score Simplification)

### Context
1. The built-in `alphaTex` demo drum track was simplified into a progressive 4-bar exercise (2 bars of quarter-note Kick/Snare alternating `36`/`38`, followed by 2 bars adding 8th-note Closed Hi-Hats `42`) for straightforward input testing.
2. Pressing mapped keys or clicking pads in `TriggerBar.vue` needed to produce immediate audible drum sounds, including while the `alphaTab` score player is actively playing.
3. `@coderline/alphatab`'s built-in `api.playNote()` / `IAlphaSynth.playOneTimeMidiFile()` stops any ongoing score playback because it replaces the active sequencer buffer in the worker.

### Decision
1. **Dedicated Web Audio API Drum Synthesizer (`src/composables/useDrumSynth.ts`):**
   - Implemented a zero-latency Web Audio API synthesizer generating distinct GM drum voices (Kick `36`, Snare `38`, Closed/Open Hi-Hat `42`/`46`, High/Low-Mid Toms `50`/`47`, Crash `49`, Ride `51`, plus pitched fallback for melodic MIDI notes).
   - Subscribed `useDrumSynth` directly to `useInputBus.onInput()` so keyboard, virtual pad, debug, and future WebMIDI events all trigger live audio identically without interrupting `alphaTab` playback.
   - Stored `AudioContext` and the shared noise `AudioBuffer` in non-proxied module variables to uphold the Vue 3 hardware/audio reactivity invariant.
2. **Pad Audio Toggle (`TriggerBar.vue`):**
   - Added a `Pad Audio On / Muted` toggle (`data-testid="toggle-pad-audio"`) in `TriggerBar.vue` so users can mute local synth output when using external hardware monitoring.

### Consequences
- **Positive:** Sub-2ms drum audio response on every key press or pad click that mixes seamlessly alongside active `alphaTab` score playback.
- **Positive:** Hardware-agnostic by listening to `useInputBus.ts`.

---

## ADR-005: Sound & Track Mixer Dialog (`SoundSettingsDialog.vue`)
- **Date:** 2026-11-09
- **Status:** Accepted
- **Phase:** Phase 1 Refinement (Multi-Track Audio Mixer)

### Context
Users practicing along with multi-track scores need independent volume, mute, and solo controls for each score track (e.g., muting or lowering the score's `Studio Drum Kit` track while keeping the `Electric Finger Bass` backing track audible), as well as independent level controls for the live keyboard/pad drum synthesizer, score master volume, and metronome click.

### Decision
1. **Engine Mixer Controls in `useAlphaTab.ts` & `useDrumSynth.ts`:**
   - Extended `TrackSummary` with `volumePercent`, `isMuted`, and `isSolo`, and added `setTrackVolume`, `toggleTrackMute`, `toggleTrackSolo`, `setMasterVolume`, `setMetronomeVolume`, and `resetAudioMix` in `useAlphaTab.ts` (wrapping `alphaTab.model.Track` references with `markRaw()` before passing to `api.changeTrackVolume` / `changeTrackMute` / `changeTrackSolo`).
   - Added `volumePercent` (`0%`–`150%`) and `setVolumePercent` to `useDrumSynth.ts`.
2. **Accessible Modal Mixer (`src/components/SoundSettingsDialog.vue`):**
   - Built a native `<dialog closedby="any">` modal opened via `.showModal()` from a `🎛 Sound Settings` button in `TransportToolbar.vue`, complete with a `<form method="dialog">` close action and a backdrop-click fallback for browsers without native `closedBy` support.

### Consequences
- **Positive:** Users can balance or mute any score track (such as muting the recorded drum track to hear only their own live drumming over the bass track) and toggle the built-in metronome click.

---

## ADR-006: Phase 2 Implementation — Timing & Hit Evaluation Engine (`useHitEvaluation.ts` & `HitEvaluationHud.vue`)
- **Date:** 2026-11-09
- **Status:** Accepted
- **Phase:** Phase 2 (Timing & Hit Evaluation Engine — `v0.2.0`)

### Context
Phase 2 requires evaluating incoming `PracticeInputEvent` messages against the active `alphaTab` score track in real time across variable playback speeds (`25%`–`200%`), chords/simultaneous drum hits (such as Kick `36` + Hi-Hat `42` on the same beat), and loop wrap-arounds.

### Decision
1. **Active Track Target Note Extraction (`useAlphaTab.ts`):**
   - On `scoreLoaded` and `selectTrack`, `extractTrackTargetNotes` traverses `staff -> bar -> voice -> beat -> note`, skipping rests and tied destination notes, and extracts sorted `TargetScoreNote` records using `beat.absolutePlaybackStart` (960 ticks/quarter note) and `note.realValue` (which normalizes both GP7 percussion articulations and melodic pitches to MIDI note numbers).
2. **Tempo-Normalized Millisecond Window Evaluation (`useHitEvaluation.ts`):**
   - Converts tick deltas (`activeTick - target.tick`) to real-time milliseconds at the effective BPM (`baseTempoBpm * tempoPercent / 100`), with sub-frame tick interpolation from `lastPositionPerfMs`.
   - Applies standard judgment tiers and directional `TimingStatus` within a `±180 ms` candidate window:
     - **On Time (`Perfect`):** `|deltaMs| <= 55 ms`
     - **Early / Late (`Good`):** `55 ms < |deltaMs| <= 125 ms`
     - **Too Early / Too Late (`Miss`):** `125 ms < |deltaMs| <= 180 ms`
     - **Off-Beat / Wrong Note / Passed (`Miss`):** no matching note within `±180 ms` or unplayed note passed by `>145 ms`.
   - Automatically clears per-loop evaluated note locks (`evaluatedNoteIds`) and bar markings (`passResults`) only when `isLooping` wraps backward during active looping or when starting a new playback pass from tick `0`.
   - When non-looping playback reaches the end of the score (`playerFinished`) or when the user presses **Stop** during playback, the player halts in place (`isFinished = true` / `parkCursorAtEnd()`) instead of rewinding to tick `0`, preserving all over-the-bar precision markings so the user can analyze their performance.
   - Leaves paused/stopped state in **Free Play** mode so users can test pads without accumulating misses.
3. **Live Accuracy & Timing HUD (`HitEvaluationHud.vue`) & Over-the-Bar Score Overlay (`ScoreViewport.vue`):**
   - Displays live judgment pill (`PERFECT`, `GOOD`, `MISS`, `FREE PLAY`), signed timing error (`-Early` / `+Late` ms), visual center-zero offset gauge, upcoming beat note & key hints (`Next:`), weighted accuracy percentage, streak/best streak, and hit breakdown counters.
   - Enabled `settings.core.includeNoteBounds = true` and added `resolveHitCoordinates()` in `useAlphaTab.ts` using `api.boundsLookup` (`NoteBounds.noteHeadBounds`) to render color-coded precision circles directly around each evaluated notehead on the score surface: **Purple** (`#9333ea`) for Early, **Green** (`#059669`) for On Time, **Yellow/Orange** (`#d97706`) for Late, and **Red** (`#dc2626`) for Miss.

### Consequences
- **Positive:** Works identically for percussion and melodic tracks and across any input adapter (`keyboard`, `virtual-pad`, `debug`, and future `webmidi`).
- **Positive:** Exposes `getEvaluationState()` and `resetEvaluation()` on `window.__TRAINER_DEBUG__` for deterministic automated verification.




