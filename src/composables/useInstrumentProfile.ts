import { computed, readonly, ref } from 'vue'
import { DEFAULT_KEY_MAP, getMidiNoteInfo } from '../constants/defaultKeyMap'
import type { InstrumentProfile, KeyPadBinding } from '../types/input'

export const DEFAULT_INSTRUMENT_PROFILE: InstrumentProfile = {
  id: 'gm-standard-drums',
  name: 'GM Standard Drum Kit (Keyboard / Pads)',
  isPercussion: true,
  bindings: DEFAULT_KEY_MAP,
  midiAliases: {
    35: 36, // Acoustic Bass Drum -> Kick Drum (36)
    40: 38, // Electric Snare / Rimshot -> Acoustic Snare (38)
    44: 42, // Pedal Hi-Hat -> Closed Hi-Hat (42)
  },
}

const profiles = ref<InstrumentProfile[]>([DEFAULT_INSTRUMENT_PROFILE])
const activeProfileId = ref<string>(DEFAULT_INSTRUMENT_PROFILE.id)

const activeProfile = computed<InstrumentProfile>(() => {
  return (
    profiles.value.find((p) => p.id === activeProfileId.value) ??
    DEFAULT_INSTRUMENT_PROFILE
  )
})

const bindings = computed<readonly KeyPadBinding[]>(
  () => activeProfile.value.bindings,
)

const bindingByCode = computed<ReadonlyMap<string, KeyPadBinding>>(
  () => new Map(activeProfile.value.bindings.map((b) => [b.code, b])),
)

const bindingByNote = computed<ReadonlyMap<number, KeyPadBinding>>(
  () => new Map(activeProfile.value.bindings.map((b) => [b.note, b])),
)

/**
 * Decoupled Instrument Profile & Voice Mapping composable (`useInstrumentProfile.ts`).
 *
 * Allows input adapters (`useKeyboardInput`, future `useWebMidiInput`), the score parser
 * (`useAlphaTab`), and the evaluation engine (`useHitEvaluation`) to resolve key bindings,
 * note labels, and multi-zone MIDI note aliases through a reactive profile registry rather
 * than hardcoding static key maps.
 */
export function useInstrumentProfile() {
  function resolveMidiNote(rawMidiNote: number): number {
    const aliases = activeProfile.value.midiAliases
    return aliases?.[rawMidiNote] ?? rawMidiNote
  }

  function getNoteInfo(
    midiNote: number,
    isPercussion = true,
  ): { label: string; shortLabel: string; keyHint?: string } {
    const canonical = resolveMidiNote(midiNote)
    const activeBinding = bindingByNote.value.get(canonical)
    const baseInfo = getMidiNoteInfo(canonical, isPercussion)
    if (activeBinding) {
      return {
        label: activeBinding.name,
        shortLabel: baseInfo.shortLabel,
        keyHint: activeBinding.keyLabel,
      }
    }
    return baseInfo
  }

  function registerProfile(profile: InstrumentProfile): void {
    const idx = profiles.value.findIndex((p) => p.id === profile.id)
    if (idx >= 0) {
      const next = [...profiles.value]
      next[idx] = profile
      profiles.value = next
    } else {
      profiles.value = [...profiles.value, profile]
    }
  }

  function selectProfile(profileId: string): void {
    if (profiles.value.some((p) => p.id === profileId)) {
      activeProfileId.value = profileId
    }
  }

  return {
    profiles: readonly(profiles),
    activeProfileId: readonly(activeProfileId),
    activeProfile,
    bindings,
    bindingByCode,
    bindingByNote,
    resolveMidiNote,
    getNoteInfo,
    registerProfile,
    selectProfile,
  }
}
