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
