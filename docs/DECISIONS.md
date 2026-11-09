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

