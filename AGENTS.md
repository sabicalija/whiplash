# Whiplash — Agent Rules & Project Architecture

Whiplash is an extensible, instrument-agnostic **Music & Percussion Practice Trainer** built with Vue 3, Vite, TypeScript, and `@coderline/alphatab`.

## 1. Tech Stack
- **Package Manager:** `pnpm`
- **Framework:** Vue 3 (`<script setup lang="ts">`), Composition API
- **Bundler & Build:** Vite + `@vitejs/plugin-vue` + `@coderline/alphatab-vite`
- **Language:** TypeScript (`strict: true`)
- **Notation & Synth Engine:** `@coderline/alphatab`

## 2. Current Project State
- **Status:** **Phase 1 Completed & Verified** (Core alphaTab Player & Keyboard Input Adapter).
- **Entry Points:** `src/main.ts`, `src/App.vue`
- **Core Composables:**
  - `src/composables/useAlphaTab.ts`: Manages `AlphaTabApi` lifecycle (`shallowRef` + `markRaw`), built-in 2-track `alphaTex` 1.9 score (`src/constants/defaultScore.ts`), `.gp3`–`.gp8` drag-and-drop & file picker loading, track switching, and transport controls (Play/Pause, Stop, Loop, Tempo 25%–200%).
  - `src/composables/useInputBus.ts`: Hardware-agnostic event bus for normalized `PracticeInputEvent` messages with recent event ring buffer and visual pad flash state.
  - `src/composables/useKeyboardInput.ts`: Phase 1 `KeyboardInputAdapter` mapping `Space`, `S`, `D`, `F`, `J`, `K`, `L` and virtual pad clicks to GM drum MIDI notes (`src/constants/defaultKeyMap.ts`).
  - `src/composables/useDrumSynth.ts`: Zero-latency Web Audio API drum/percussion synthesizer subscribed to `useInputBus` so keyboard, pad, and MIDI hits produce audible drum feedback without interrupting `alphaTab` playback.
- **UI Components:** `TransportToolbar.vue`, `ScoreViewport.vue`, `TriggerBar.vue`

## 3. Progressive Roadmap
- [x] **Phase 1: Core alphaTab Player & Keyboard Input Adapter** (Built-in demo tab, `.gp` file loader, track selector for percussion or melodic tracks, playback/tempo/loop controls, and mapped PC keyboard input with visual trigger feedback).
- [ ] **Phase 2: Timing & Hit Evaluation Engine** (Comparing `PracticeInputEvent` timestamps against active `alphaTab` beat ticks with Perfect/Good/Miss windows and live accuracy HUD).
- [ ] **Phase 3: Generic WebMIDI & Interactive Input Mapper** (Connecting any USB-MIDI device, MIDI Learn UI to bind any incoming MIDI note or key to target score notes).
- [ ] **Phase 4: Instrument Profiles & Multi-Zone Presets** (Plug-and-play presets starting with Roland TD-27KV bow/edge/rim normalization, plus profiles for other e-drums and melodic instruments).

## 4. Vue 3 + alphaTab Invariants
1. **No Deep Reactivity on Engine or Hardware Objects:**
   - **NEVER** wrap `AlphaTabApi` instances, `AudioContext`/`AudioWorklet` nodes, or future `MIDIInput`/`MIDIAccess` objects in Vue's deep `ref()` or `reactive()` proxies. Deep proxying breaks internal web workers, private fields, and audio/MIDI bindings.
   - Always store these instances in a plain variable, `shallowRef()`, or wrap them with `markRaw()`.
2. **Lifecycle Management:**
   - Instantiate `AlphaTabApi` inside `onMounted()` after the container DOM element is mounted.
   - Always call `api.destroy()` inside `onBeforeUnmount()` to terminate web workers and release audio resources.
3. **Static Asset Configuration:**
   - Always configure `core.fontDirectory` as `` `${import.meta.env.BASE_URL}font/` ``.
   - Always configure `player.soundFont` as `` `${import.meta.env.BASE_URL}soundfont/sonivox.sf2` ``.

## 5. Instrument-Agnostic Input Architecture
- Decouple physical input hardware from score evaluation using the unified `PracticeInputEvent` interface (`src/types/input.ts`):
  ```ts
  export interface PracticeInputEvent {
    timestamp: number // performance.now() in ms
    note: number      // Target MIDI note number (0-127)
    velocity: number  // Normalized MIDI velocity (1-127)
    sourceId: string  // Adapter ID ('keyboard', 'virtual-pad', 'webmidi', 'debug')
    rawCode: string   // Raw key/hardware code ('Space', 'KeyF', 'midi:ch10:38')
    label?: string    // Optional voice label
  }
  ```
- Input adapters (`KeyboardInputAdapter` in Phase 1, `WebMidiInputAdapter` in Phase 3) must emit normalized `PracticeInputEvent` payloads into the shared input bus (`useInputBus.ts`) so the core trainer operates identically with a laptop keyboard, a generic MIDI controller, or a multi-zone e-drum module.

## 6. Browser Agent Observability (`data-testid` & Debug Hooks)
- All interactive controls and status containers must expose semantic `data-testid` attributes and reactive `data-*` state attributes (`data-player-ready`, `data-soundfont-loaded`, `data-is-playing`, `data-is-looping`, `data-tempo`, `data-active-track`, `data-last-note`, `data-input-count`) so browser subagents can deterministically verify UI state alongside screenshots.
- In `import.meta.env.DEV` mode, expose `window.__TRAINER_DEBUG__` with methods to programmatically emit synthetic `PracticeInputEvent` notes (`emitInput`) and inspect active `alphaTab` beat/tick and transport state (`getPlayerState`, `getRecentInputs`).

## 7. Living Documentation Rule (Mandatory Agent Workflow)
At the end of every completed feature or phase, the agent **MUST**:
1. Update the Roadmap checkboxes and **Current Project State** summary in `AGENTS.md` (keep `AGENTS.md` concise—under 150 lines—so context stays fast).
2. Append a dated entry to `docs/DECISIONS.md` documenting key architectural decisions, file structure changes, and known trade-offs made during the session.

## 8. Git Workflow, Conventional Commits & Semantic Versioning
1. **Conventional Commits 1.0.0 (`https://www.conventionalcommits.org/en/v1.0.0/`):**
   - Format all commit messages as `<type>[optional scope]: <description>` (e.g., `feat(player): ...`, `fix(input): ...`, `docs: ...`, `build: ...`, `refactor: ...`, `test: ...`, `chore: ...`).
   - Append `!` after the type/scope or include a `BREAKING CHANGE:` footer when introducing incompatible API or architectural changes.
2. **Modular, Atomic Commits:**
   - Never bundle unrelated features, infrastructure changes, and documentation updates into a single bulk commit.
   - Stage and commit each coherent logical unit separately (e.g., build/config scaffolding -> core domain/composables -> UI components -> documentation).
3. **Semantic Versioning 2.0.0 (`https://semver.org/`):**
   - Track project version in `package.json` (`MAJOR.MINOR.PATCH`) and git tags (`vMAJOR.MINOR.PATCH`).
   - During initial development (`0.y.z`), increment `MINOR` (`0.1.0` -> `0.2.0`) for each completed roadmap phase or significant feature set, and `PATCH` (`0.1.x`) for bug fixes and refinements.
