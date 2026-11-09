<script setup lang="ts">
import type { KeyPadBinding, PracticeInputEvent } from '../types/input'

defineProps<{
  bindings: readonly KeyPadBinding[]
  activeCodes: Readonly<Record<string, boolean>>
  lastEvent: PracticeInputEvent | null
  recentEvents: readonly PracticeInputEvent[]
  totalEventCount: number
  isPadAudioEnabled: boolean
}>()

const emit = defineEmits<{
  triggerPad: [binding: KeyPadBinding]
  clearLog: []
  togglePadAudio: []
}>()
</script>

<template>
  <section
    class="trigger-dock"
    aria-label="Practice Input Trigger Bar and Event Telemetry"
    data-testid="trigger-bar"
    :data-last-note="lastEvent?.note ?? ''"
    :data-last-code="lastEvent?.rawCode ?? ''"
    :data-input-count="totalEventCount"
    :data-pad-audio-enabled="String(isPadAudioEnabled)"
  >
    <div class="pads-column">
      <div class="dock-header">
        <div class="dock-title-group">
          <h2 class="dock-title">Keyboard / Pad Trigger Bar</h2>
          <span class="dock-subtitle">
            Press mapped keys (<code>Space</code>, <code>S</code>, <code>D</code>, <code>F</code>,
            <code>J</code>, <code>K</code>, <code>L</code>) or click a pad
          </span>
        </div>
        <div class="dock-header-actions">
          <div
            v-if="lastEvent"
            class="last-hit-pill"
            data-testid="last-hit-indicator"
          >
            Last Trigger:
            <strong>{{ lastEvent.label ?? `MIDI ${lastEvent.note}` }}</strong>
            <span>(Note {{ lastEvent.note }} · {{ lastEvent.rawCode }} · vel {{ lastEvent.velocity }})</span>
          </div>
          <button
            type="button"
            class="btn btn-sm"
            :class="{ 'btn-active': isPadAudioEnabled }"
            :aria-pressed="isPadAudioEnabled"
            data-testid="toggle-pad-audio"
            @click="emit('togglePadAudio')"
          >
            <span aria-hidden="true">{{ isPadAudioEnabled ? '🔊' : '🔇' }}</span>
            <span>{{ isPadAudioEnabled ? 'Pad Audio On' : 'Pad Audio Muted' }}</span>
          </button>
        </div>
      </div>

      <div class="pad-grid" role="group" aria-label="Drum and Note Trigger Pads">
        <button
          v-for="binding in bindings"
          :key="binding.code"
          type="button"
          class="trigger-pad"
          :class="[
            `cat-${binding.category.toLowerCase()}`,
            { 'is-flashing': Boolean(activeCodes[binding.code]) },
          ]"
          :data-testid="`trigger-pad-${binding.code}`"
          :data-note="binding.note"
          :data-code="binding.code"
          :data-active="String(Boolean(activeCodes[binding.code]))"
          @mousedown.prevent="emit('triggerPad', binding)"
        >
          <span class="pad-category">{{ binding.category }}</span>
          <kbd class="pad-keycap">{{ binding.keyLabel }}</kbd>
          <span class="pad-voice-name">{{ binding.name }}</span>
          <span class="pad-midi-note">MIDI {{ binding.note }}</span>
        </button>
      </div>
    </div>

    <aside class="telemetry-column" aria-label="Normalized Input Event Stream">
      <div class="telemetry-header">
        <span class="telemetry-title">
          Input Bus Stream (<code>PracticeInputEvent</code>)
        </span>
        <div class="telemetry-meta">
          <span class="count-badge" data-testid="event-count-badge">
            {{ totalEventCount }} hits
          </span>
          <button
            v-if="totalEventCount > 0"
            type="button"
            class="btn-link"
            data-testid="clear-event-log"
            @click="emit('clearLog')"
          >
            Clear
          </button>
        </div>
      </div>

      <ul
        class="event-log-list"
        data-testid="event-log-list"
      >
        <li
          v-if="recentEvents.length === 0"
          class="event-log-empty"
          data-testid="event-log-empty"
        >
          Waiting for keyboard or pad input…
        </li>
        <li
          v-for="(ev, idx) in recentEvents"
          :key="`${ev.timestamp}-${idx}`"
          class="event-log-item"
          data-testid="event-log-item"
          :data-event-note="ev.note"
          :data-event-source="ev.sourceId"
        >
          <span class="ev-note">MIDI {{ ev.note }}</span>
          <span class="ev-label">{{ ev.label ?? ev.rawCode }}</span>
          <span class="ev-source">{{ ev.sourceId }}</span>
          <span class="ev-time">{{ Math.round(ev.timestamp) }}ms</span>
        </li>
      </ul>
    </aside>
  </section>
</template>
