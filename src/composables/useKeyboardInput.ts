import { onMounted, onBeforeUnmount, ref } from 'vue'
import { DEFAULT_KEY_MAP, KEY_MAP_BY_CODE } from '../constants/defaultKeyMap'
import type { KeyPadBinding, PracticeInputEvent } from '../types/input'
import { useInputBus } from './useInputBus'

function isInteractiveFormElement(target: EventTarget | null): boolean {
  if (!(target instanceof HTMLElement)) {
    return false
  }
  const tag = target.tagName
  return (
    tag === 'INPUT' ||
    tag === 'SELECT' ||
    tag === 'TEXTAREA' ||
    target.isContentEditable
  )
}

/**
 * Phase 1 `KeyboardInputAdapter` composable (`useKeyboardInput.ts`).
 * Listens for mapped physical keyboard keys and virtual pad triggers,
 * emitting normalized `PracticeInputEvent` payloads into `useInputBus`.
 */
export function useKeyboardInput() {
  const inputBus = useInputBus()
  const isEnabled = ref<boolean>(true)
  const keyBindings = ref< readonly KeyPadBinding[] >(DEFAULT_KEY_MAP)

  function triggerBinding(
    binding: KeyPadBinding,
    sourceId: 'keyboard' | 'virtual-pad' | 'debug' = 'keyboard',
    velocity = 100,
  ): PracticeInputEvent {
    const payload: PracticeInputEvent = {
      timestamp: performance.now(),
      note: binding.note,
      velocity,
      sourceId,
      rawCode: binding.code,
      label: binding.name,
    }
    return inputBus.emit(payload)
  }

  function handleKeyDown(event: KeyboardEvent): void {
    if (!isEnabled.value) {
      return
    }
    if (event.repeat || event.ctrlKey || event.metaKey || event.altKey) {
      return
    }
    if (isInteractiveFormElement(event.target)) {
      return
    }

    const binding = KEY_MAP_BY_CODE.get(event.code)
    if (!binding) {
      return
    }

    event.preventDefault()
    triggerBinding(binding, 'keyboard', 105)
  }

  onMounted(() => {
    window.addEventListener('keydown', handleKeyDown)
  })

  onBeforeUnmount(() => {
    window.removeEventListener('keydown', handleKeyDown)
  })

  return {
    isEnabled,
    keyBindings,
    triggerBinding,
  }
}
