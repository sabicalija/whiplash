import { onMounted, onBeforeUnmount, ref } from 'vue'
import type { KeyPadBinding, PracticeInputEvent } from '../types/input'
import { useInputBus } from './useInputBus'
import { useInputRegistry } from './useInputRegistry'
import { useInstrumentProfile } from './useInstrumentProfile'

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
 * Listens for mapped physical keyboard keys and virtual pad triggers
 * using the active `InstrumentProfile` (`useInstrumentProfile`) and registers
 * with `useInputRegistry`, emitting normalized `PracticeInputEvent` payloads into `useInputBus`.
 */
export function useKeyboardInput() {
  const inputBus = useInputBus()
  const inputRegistry = useInputRegistry()
  const profile = useInstrumentProfile()
  const isEnabled = ref<boolean>(true)
  const keyBindings = profile.bindings

  function triggerBinding(
    binding: KeyPadBinding,
    sourceId: 'keyboard' | 'virtual-pad' | 'debug' = 'keyboard',
    velocity = 100,
  ): PracticeInputEvent {
    const payload: PracticeInputEvent = {
      timestamp: performance.now(),
      note: profile.resolveMidiNote(binding.note),
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

    const binding = profile.bindingByCode.value.get(event.code)
    if (!binding) {
      return
    }

    event.preventDefault()
    triggerBinding(binding, 'keyboard', 105)
  }

  onMounted(() => {
    inputRegistry.registerAdapter({
      id: 'keyboard',
      name: 'PC Keyboard Trigger Adapter',
      kind: 'keyboard',
      isAvailable: true,
      isConnected: true,
      isEnabled: isEnabled.value,
    })
    inputRegistry.registerAdapter({
      id: 'virtual-pad',
      name: 'On-Screen Drum Pad Matrix',
      kind: 'virtual-pad',
      isAvailable: true,
      isConnected: true,
      isEnabled: true,
    })
    window.addEventListener('keydown', handleKeyDown)
  })

  onBeforeUnmount(() => {
    window.removeEventListener('keydown', handleKeyDown)
    inputRegistry.updateAdapterStatus('keyboard', { isConnected: false })
  })

  return {
    isEnabled,
    keyBindings,
    triggerBinding,
  }
}
