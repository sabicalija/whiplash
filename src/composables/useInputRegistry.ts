import { readonly, ref } from 'vue'
import type { InputAdapterDescriptor } from '../types/input'

const adapters = ref<InputAdapterDescriptor[]>([])

/**
 * Pluggable Input Adapter Registry (`useInputRegistry.ts`).
 *
 * Tracks all available and active input adapters (`keyboard`, `virtual-pad`,
 * and future `webmidi` or `audio` adapters) without coupling UI or evaluation
 * components to specific hardware listeners.
 */
export function useInputRegistry() {
  function registerAdapter(descriptor: InputAdapterDescriptor): void {
    const idx = adapters.value.findIndex((a) => a.id === descriptor.id)
    if (idx >= 0) {
      const next = [...adapters.value]
      next[idx] = descriptor
      adapters.value = next
    } else {
      adapters.value = [...adapters.value, descriptor]
    }
  }

  function updateAdapterStatus(
    id: string,
    patch: Partial<Omit<InputAdapterDescriptor, 'id'>>,
  ): void {
    const idx = adapters.value.findIndex((a) => a.id === id)
    if (idx < 0) {
      return
    }
    const current = adapters.value[idx]
    if (!current) {
      return
    }
    const next = [...adapters.value]
    next[idx] = { ...current, ...patch }
    adapters.value = next
  }

  function unregisterAdapter(id: string): void {
    adapters.value = adapters.value.filter((a) => a.id !== id)
  }

  return {
    adapters: readonly(adapters),
    registerAdapter,
    updateAdapterStatus,
    unregisterAdapter,
  }
}
