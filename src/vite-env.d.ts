/// <reference types="vite/client" />

import type { TrainerDebugApi } from './types/input'

declare global {
  interface Window {
    __TRAINER_DEBUG__?: TrainerDebugApi
  }
}
