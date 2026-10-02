export type Phase = 'idle' | 'focus' | 'break'
export type Pomo = { phase: Phase; startedAt: number; endsAt: number }
/** Finished focus sessions: today's count (by local date) and all-time. */
export type Rings = { day: string; today: number; total: number }

declare module 'claude-code' {
  interface PluginState {
    pomodawd: { timer: Pomo; rings: Rings; shown: boolean }
  }
}
