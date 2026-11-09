import { ref, readonly } from 'vue'
import type { PracticeInputEvent } from '../types/input'

type InputListener = (event: PracticeInputEvent) => void

const MAX_RECENT_EVENTS = 25
const FLASH_DURATION_MS = 140

const listeners = new Set<InputListener>()
const lastEvent = ref<PracticeInputEvent | null>(null)
const totalEventCount = ref<number>(0)
const recentEvents = ref<PracticeInputEvent[]>([])
const activeCodes = ref<Record<string, boolean>>({})
const flashTimers = new Map<string, ReturnType<typeof setTimeout>>()

function triggerFlash(rawCode: string): void {
  const existingTimer = flashTimers.get(rawCode)
  if (existingTimer !== undefined) {
    clearTimeout(existingTimer)
  }
  activeCodes.value = {
    ...activeCodes.value,
    [rawCode]: true,
  }
  const timer = setTimeout(() => {
    const next = { ...activeCodes.value }
    delete next[rawCode]
    activeCodes.value = next
    flashTimers.delete(rawCode)
  }, FLASH_DURATION_MS)
  flashTimers.set(rawCode, timer)
}

function emit(event: PracticeInputEvent): PracticeInputEvent {
  lastEvent.value = event
  totalEventCount.value += 1
  recentEvents.value = [event, ...recentEvents.value.slice(0, MAX_RECENT_EVENTS - 1)]
  triggerFlash(event.rawCode)

  for (const listener of listeners) {
    listener(event)
  }
  return event
}

function onInput(listener: InputListener): () => void {
  listeners.add(listener)
  return () => {
    listeners.delete(listener)
  }
}

function clearHistory(): void {
  lastEvent.value = null
  totalEventCount.value = 0
  recentEvents.value = []
}

/**
 * Shared instrument-agnostic input bus (`useInputBus.ts`).
 * Decouples physical input adapters (Keyboard in Phase 1, WebMIDI in Phase 3)
 * from score evaluation and UI telemetry.
 */
export function useInputBus() {
  return {
    lastEvent: readonly(lastEvent),
    totalEventCount: readonly(totalEventCount),
    recentEvents: readonly(recentEvents),
    activeCodes: readonly(activeCodes),
    emit,
    onInput,
    clearHistory,
  }
}
