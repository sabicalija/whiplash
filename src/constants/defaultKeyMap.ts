import type { KeyPadBinding } from '../types/input'

/**
 * Default Phase 1 keyboard bindings mapping ergonomic home-row + Spacebar keys
 * to General MIDI (GM) standard percussion notes.
 */
export const DEFAULT_KEY_MAP: readonly KeyPadBinding[] = [
  {
    code: 'Space',
    keyLabel: 'Space',
    note: 36,
    name: 'Kick Drum',
    category: 'KICK',
  },
  {
    code: 'KeyS',
    keyLabel: 'S',
    note: 49,
    name: 'Crash Cymbal 1',
    category: 'CYM',
  },
  {
    code: 'KeyD',
    keyLabel: 'D',
    note: 50,
    name: 'High Tom',
    category: 'TOM',
  },
  {
    code: 'KeyF',
    keyLabel: 'F',
    note: 38,
    name: 'Acoustic Snare',
    category: 'SNARE',
  },
  {
    code: 'KeyJ',
    keyLabel: 'J',
    note: 42,
    name: 'Closed Hi-Hat',
    category: 'HAT',
  },
  {
    code: 'KeyK',
    keyLabel: 'K',
    note: 47,
    name: 'Low-Mid Tom',
    category: 'TOM',
  },
  {
    code: 'KeyL',
    keyLabel: 'L',
    note: 51,
    name: 'Ride Cymbal 1',
    category: 'CYM',
  },
] as const

export const KEY_MAP_BY_CODE: ReadonlyMap<string, KeyPadBinding> = new Map(
  DEFAULT_KEY_MAP.map((binding) => [binding.code, binding]),
)

export const KEY_MAP_BY_NOTE: ReadonlyMap<number, KeyPadBinding> = new Map(
  DEFAULT_KEY_MAP.map((binding) => [binding.note, binding]),
)

const GM_PERCUSSION_NAMES: Readonly<Record<number, string>> = {
  35: 'Acoustic Bass Drum',
  36: 'Kick Drum',
  37: 'Side Stick',
  38: 'Acoustic Snare',
  40: 'Electric Snare',
  41: 'Low Floor Tom',
  42: 'Closed Hi-Hat',
  43: 'High Floor Tom',
  44: 'Pedal Hi-Hat',
  45: 'Low Tom',
  46: 'Open Hi-Hat',
  47: 'Low-Mid Tom',
  48: 'Hi-Mid Tom',
  49: 'Crash Cymbal 1',
  50: 'High Tom',
  51: 'Ride Cymbal 1',
  52: 'Chinese Cymbal',
  53: 'Ride Bell',
  55: 'Splash Cymbal',
  57: 'Crash Cymbal 2',
  59: 'Ride Cymbal 2',
}

const GM_PERCUSSION_SHORT_CODES: Readonly<Record<number, string>> = {
  35: 'K',
  36: 'K',
  37: 'SS',
  38: 'S',
  40: 'S',
  41: 'FT',
  42: 'HH',
  43: 'FT',
  44: 'PH',
  45: 'LT',
  46: 'OH',
  47: 'MT',
  48: 'HT',
  49: 'CR',
  50: 'HT',
  51: 'RD',
  52: 'CH',
  53: 'RB',
  55: 'SP',
  57: 'CR',
  59: 'RD',
}

const PITCH_CLASSES = ['C', 'C#', 'D', 'D#', 'E', 'F', 'F#', 'G', 'G#', 'A', 'A#', 'B'] as const

export function getMidiNoteInfo(
  midiNote: number,
  isPercussion = true,
): { label: string; shortLabel: string; keyHint?: string } {
  const binding = KEY_MAP_BY_NOTE.get(midiNote)
  if (binding) {
    return {
      label: binding.name,
      shortLabel: GM_PERCUSSION_SHORT_CODES[midiNote] ?? binding.keyLabel,
      keyHint: binding.keyLabel,
    }
  }
  if (isPercussion && GM_PERCUSSION_NAMES[midiNote]) {
    return {
      label: GM_PERCUSSION_NAMES[midiNote],
      shortLabel: GM_PERCUSSION_SHORT_CODES[midiNote] ?? `N${midiNote}`,
    }
  }
  const pitch = PITCH_CLASSES[((midiNote % 12) + 12) % 12] ?? 'C'
  const octave = Math.floor(midiNote / 12) - 1
  return {
    label: `${pitch}${octave} (MIDI ${midiNote})`,
    shortLabel: `${pitch}${octave}`,
  }
}
