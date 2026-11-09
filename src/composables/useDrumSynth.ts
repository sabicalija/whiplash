import { ref, readonly, onMounted, onBeforeUnmount } from 'vue'
import { useInputBus } from './useInputBus'

/**
 * Zero-latency Web Audio API Drum & Percussion Synthesizer (`useDrumSynth.ts`).
 *
 * Architectural notes:
 * 1. `@coderline/alphatab`'s internal `playNote()` stops ongoing song playback because it loads
 *    a one-off MIDI stream into the sequencer worker. Using a dedicated Web Audio API synth
 *    allows real-time pad/keyboard/MIDI hits to sound concurrently with score playback at <2ms latency.
 * 2. INVARIANT: `AudioContext` and `AudioBuffer` instances are stored in plain module variables,
 *    NEVER wrapped in Vue's deep `ref()` or `reactive()`.
 */

let audioCtx: AudioContext | null = null
let noiseBuffer: AudioBuffer | null = null

const isAudioEnabled = ref<boolean>(true)
const volumePercent = ref<number>(100)
const lastPlayedNote = ref<number | null>(null)

function getOrCreateAudioContext(): AudioContext | null {
  if (typeof window === 'undefined') {
    return null
  }
  if (!audioCtx) {
    const AudioContextClass =
      window.AudioContext ||
      (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext
    if (!AudioContextClass) {
      return null
    }
    audioCtx = new AudioContextClass()
  }
  if (audioCtx.state === 'suspended') {
    void audioCtx.resume().catch(() => {
      // Ignore autoplay errors prior to first user gesture
    })
  }
  return audioCtx
}

function getOrCreateNoiseBuffer(ctx: AudioContext): AudioBuffer {
  if (noiseBuffer && noiseBuffer.sampleRate === ctx.sampleRate) {
    return noiseBuffer
  }
  const durationSeconds = 1.5
  const length = Math.floor(ctx.sampleRate * durationSeconds)
  const buffer = ctx.createBuffer(1, length, ctx.sampleRate)
  const data = buffer.getChannelData(0)
  for (let i = 0; i < length; i++) {
    data[i] = Math.random() * 2 - 1
  }
  noiseBuffer = buffer
  return buffer
}

function playKick(ctx: AudioContext, now: number, gainScale: number): void {
  // Low sub/body pitch sweep (155 Hz -> 42 Hz)
  const osc = ctx.createOscillator()
  const bodyGain = ctx.createGain()
  osc.type = 'sine'
  osc.frequency.setValueAtTime(155, now)
  osc.frequency.exponentialRampToValueAtTime(52, now + 0.065)
  osc.frequency.exponentialRampToValueAtTime(38, now + 0.24)

  bodyGain.gain.setValueAtTime(0.95 * gainScale, now)
  bodyGain.gain.exponentialRampToValueAtTime(0.001, now + 0.26)

  osc.connect(bodyGain)
  bodyGain.connect(ctx.destination)
  osc.start(now)
  osc.stop(now + 0.27)

  // Beater attack click (audible on small laptop speakers)
  const clickOsc = ctx.createOscillator()
  const clickGain = ctx.createGain()
  clickOsc.type = 'triangle'
  clickOsc.frequency.setValueAtTime(420, now)
  clickOsc.frequency.exponentialRampToValueAtTime(85, now + 0.022)

  clickGain.gain.setValueAtTime(0.45 * gainScale, now)
  clickGain.gain.exponentialRampToValueAtTime(0.001, now + 0.025)

  clickOsc.connect(clickGain)
  clickGain.connect(ctx.destination)
  clickOsc.start(now)
  clickOsc.stop(now + 0.03)
}

function playSnare(ctx: AudioContext, now: number, gainScale: number): void {
  // Drumhead fundamental body tone
  const bodyOsc = ctx.createOscillator()
  const bodyGain = ctx.createGain()
  bodyOsc.type = 'triangle'
  bodyOsc.frequency.setValueAtTime(210, now)
  bodyOsc.frequency.exponentialRampToValueAtTime(125, now + 0.09)

  bodyGain.gain.setValueAtTime(0.55 * gainScale, now)
  bodyGain.gain.exponentialRampToValueAtTime(0.001, now + 0.12)

  bodyOsc.connect(bodyGain)
  bodyGain.connect(ctx.destination)
  bodyOsc.start(now)
  bodyOsc.stop(now + 0.13)

  // Snare wire noise burst
  const noise = ctx.createBufferSource()
  noise.buffer = getOrCreateNoiseBuffer(ctx)

  const highpass = ctx.createBiquadFilter()
  highpass.type = 'highpass'
  highpass.frequency.setValueAtTime(1200, now)

  const peaking = ctx.createBiquadFilter()
  peaking.type = 'peaking'
  peaking.frequency.setValueAtTime(3200, now)
  peaking.gain.setValueAtTime(5, now)

  const noiseGain = ctx.createGain()
  noiseGain.gain.setValueAtTime(0.65 * gainScale, now)
  noiseGain.gain.exponentialRampToValueAtTime(0.001, now + 0.19)

  noise.connect(highpass)
  highpass.connect(peaking)
  peaking.connect(noiseGain)
  noiseGain.connect(ctx.destination)

  noise.start(now)
  noise.stop(now + 0.2)
}

function playHiHat(ctx: AudioContext, now: number, gainScale: number, isOpen: boolean): void {
  const decay = isOpen ? 0.34 : 0.065

  // High-frequency metallic noise
  const noise = ctx.createBufferSource()
  noise.buffer = getOrCreateNoiseBuffer(ctx)

  const bandpass = ctx.createBiquadFilter()
  bandpass.type = 'bandpass'
  bandpass.frequency.setValueAtTime(9200, now)
  bandpass.Q.setValueAtTime(1.2, now)

  const highpass = ctx.createBiquadFilter()
  highpass.type = 'highpass'
  highpass.frequency.setValueAtTime(6500, now)

  const hatGain = ctx.createGain()
  hatGain.gain.setValueAtTime(0.55 * gainScale, now)
  hatGain.gain.exponentialRampToValueAtTime(0.001, now + decay)

  noise.connect(bandpass)
  bandpass.connect(highpass)
  highpass.connect(hatGain)
  hatGain.connect(ctx.destination)

  noise.start(now)
  noise.stop(now + decay + 0.01)

  // Metallic square-wave overtone shimmer
  const metalOsc = ctx.createOscillator()
  const metalGain = ctx.createGain()
  metalOsc.type = 'square'
  metalOsc.frequency.setValueAtTime(3840, now)

  metalGain.gain.setValueAtTime(0.08 * gainScale, now)
  metalGain.gain.exponentialRampToValueAtTime(0.0005, now + Math.min(decay, 0.045))

  metalOsc.connect(highpass)
  metalOsc.start(now)
  metalOsc.stop(now + Math.min(decay, 0.05))
}

function playTom(
  ctx: AudioContext,
  now: number,
  gainScale: number,
  startFreq: number,
  endFreq: number,
  decay: number,
): void {
  const osc = ctx.createOscillator()
  const tomGain = ctx.createGain()
  osc.type = 'sine'
  osc.frequency.setValueAtTime(startFreq, now)
  osc.frequency.exponentialRampToValueAtTime(endFreq, now + decay * 0.75)

  tomGain.gain.setValueAtTime(0.75 * gainScale, now)
  tomGain.gain.exponentialRampToValueAtTime(0.001, now + decay)

  osc.connect(tomGain)
  tomGain.connect(ctx.destination)
  osc.start(now)
  osc.stop(now + decay + 0.01)

  // Stick attack transient
  const clickOsc = ctx.createOscillator()
  const clickGain = ctx.createGain()
  clickOsc.type = 'triangle'
  clickOsc.frequency.setValueAtTime(startFreq * 2.3, now)
  clickOsc.frequency.exponentialRampToValueAtTime(startFreq, now + 0.018)

  clickGain.gain.setValueAtTime(0.28 * gainScale, now)
  clickGain.gain.exponentialRampToValueAtTime(0.001, now + 0.02)

  clickOsc.connect(clickGain)
  clickGain.connect(ctx.destination)
  clickOsc.start(now)
  clickOsc.stop(now + 0.025)
}

function playCrash(ctx: AudioContext, now: number, gainScale: number): void {
  const decay = 0.85
  const noise = ctx.createBufferSource()
  noise.buffer = getOrCreateNoiseBuffer(ctx)

  const highpass = ctx.createBiquadFilter()
  highpass.type = 'highpass'
  highpass.frequency.setValueAtTime(3200, now)

  const bandpass = ctx.createBiquadFilter()
  bandpass.type = 'peaking'
  bandpass.frequency.setValueAtTime(5600, now)
  bandpass.gain.setValueAtTime(6, now)

  const crashGain = ctx.createGain()
  crashGain.gain.setValueAtTime(0.55 * gainScale, now)
  crashGain.gain.exponentialRampToValueAtTime(0.001, now + decay)

  noise.connect(highpass)
  highpass.connect(bandpass)
  bandpass.connect(crashGain)
  crashGain.connect(ctx.destination)

  noise.start(now)
  noise.stop(now + decay + 0.02)

  // Metallic shimmer partials
  for (const freq of [1420, 2190, 3410]) {
    const osc = ctx.createOscillator()
    const oscGain = ctx.createGain()
    osc.type = 'triangle'
    osc.frequency.setValueAtTime(freq, now)
    oscGain.gain.setValueAtTime(0.06 * gainScale, now)
    oscGain.gain.exponentialRampToValueAtTime(0.0005, now + 0.35)
    osc.connect(oscGain)
    oscGain.connect(ctx.destination)
    osc.start(now)
    osc.stop(now + 0.36)
  }
}

function playRide(ctx: AudioContext, now: number, gainScale: number): void {
  const decay = 0.52
  const noise = ctx.createBufferSource()
  noise.buffer = getOrCreateNoiseBuffer(ctx)

  const highpass = ctx.createBiquadFilter()
  highpass.type = 'highpass'
  highpass.frequency.setValueAtTime(5800, now)

  const washGain = ctx.createGain()
  washGain.gain.setValueAtTime(0.32 * gainScale, now)
  washGain.gain.exponentialRampToValueAtTime(0.001, now + decay)

  noise.connect(highpass)
  highpass.connect(washGain)
  washGain.connect(ctx.destination)

  noise.start(now)
  noise.stop(now + decay + 0.02)

  // Ride bell/bow ping partials
  for (const [freq, amp, dur] of [
    [935, 0.2, 0.28],
    [2420, 0.14, 0.2],
  ] as const) {
    const osc = ctx.createOscillator()
    const pingGain = ctx.createGain()
    osc.type = 'sine'
    osc.frequency.setValueAtTime(freq, now)
    pingGain.gain.setValueAtTime(amp * gainScale, now)
    pingGain.gain.exponentialRampToValueAtTime(0.0008, now + dur)
    osc.connect(pingGain)
    pingGain.connect(ctx.destination)
    osc.start(now)
    osc.stop(now + dur + 0.01)
  }
}

function playFallbackPitch(ctx: AudioContext, now: number, note: number, gainScale: number): void {
  const freq = 440 * Math.pow(2, (note - 69) / 12)
  const osc = ctx.createOscillator()
  const gain = ctx.createGain()
  osc.type = 'triangle'
  osc.frequency.setValueAtTime(freq, now)

  gain.gain.setValueAtTime(0.35 * gainScale, now)
  gain.gain.exponentialRampToValueAtTime(0.001, now + 0.22)

  osc.connect(gain)
  gain.connect(ctx.destination)
  osc.start(now)
  osc.stop(now + 0.23)
}

export function playDrumNote(note: number, velocity = 100): boolean {
  if (!isAudioEnabled.value || volumePercent.value <= 0) {
    return false
  }
  const ctx = getOrCreateAudioContext()
  if (!ctx) {
    return false
  }

  const now = ctx.currentTime
  const clampedVelocity = Math.max(1, Math.min(127, velocity))
  const velocityScale = 0.3 + (clampedVelocity / 127) * 0.7
  const gainScale = velocityScale * (volumePercent.value / 100)
  lastPlayedNote.value = note

  switch (note) {
    case 35:
    case 36:
      playKick(ctx, now, gainScale)
      break
    case 37:
    case 38:
    case 40:
      playSnare(ctx, now, gainScale)
      break
    case 42:
    case 44:
      playHiHat(ctx, now, gainScale, false)
      break
    case 46:
      playHiHat(ctx, now, gainScale, true)
      break
    case 48:
    case 50:
      playTom(ctx, now, gainScale, 215, 118, 0.23)
      break
    case 41:
    case 43:
    case 45:
    case 47:
      playTom(ctx, now, gainScale, 155, 84, 0.27)
      break
    case 49:
    case 52:
    case 55:
    case 57:
      playCrash(ctx, now, gainScale)
      break
    case 51:
    case 53:
    case 59:
      playRide(ctx, now, gainScale)
      break
    default:
      playFallbackPitch(ctx, now, note, gainScale)
      break
  }

  return true
}

export function useDrumSynth() {
  const inputBus = useInputBus()
  let unsubscribe: (() => void) | null = null

  function setAudioEnabled(enabled: boolean): void {
    isAudioEnabled.value = enabled
  }

  function toggleAudio(): void {
    isAudioEnabled.value = !isAudioEnabled.value
  }

  function setVolumePercent(percent: number): void {
    const clamped = Math.max(0, Math.min(150, Math.round(percent)))
    volumePercent.value = clamped
  }

  onMounted(() => {
    unsubscribe = inputBus.onInput((event) => {
      playDrumNote(event.note, event.velocity)
    })
  })

  onBeforeUnmount(() => {
    if (unsubscribe) {
      unsubscribe()
      unsubscribe = null
    }
  })

  return {
    isAudioEnabled: readonly(isAudioEnabled),
    volumePercent: readonly(volumePercent),
    lastPlayedNote: readonly(lastPlayedNote),
    playDrumNote,
    setAudioEnabled,
    toggleAudio,
    setVolumePercent,
  }
}
