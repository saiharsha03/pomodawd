// Clawd at a desk while you focus, in a hammock on the break, and a tree that grows a ring per session.
// Pure: frame() turns the timer and the time into Raster cells.
import { canvas, cells, clawd, ground, GROUND, label, mix, put, rect, type Canvas, type Glyph } from './art'

import type { Rings, Pomo } from '../types'

export const FOCUS_MS = 25 * 60_000
export const BREAK_MS = 5 * 60_000

export const IDLE: Pomo = { phase: 'idle', startedAt: 0, endsAt: 0 }
export const NO_RINGS: Rings = { day: '', today: 0, total: 0 }

const TEXT = 0x9aa0ac
const DIM = 0x5c6270
const WOOD = 0x7a4a24
const LEAF = 0x5f9a5a
const FOCUS = 0xd97757
const REST = 0x8fa8d8

export const clock = (ms: number) => {
  const s = Math.max(0, Math.ceil(ms / 1000))
  return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`
}

/** The local date, as rings are counted per day. */
export const dayOf = (now: number) => {
  const d = new Date(now)
  return `${d.getFullYear()}-${d.getMonth() + 1}-${d.getDate()}`
}

/** One more finished focus session; a new day starts today's count over. */
export const addRing = (r: Rings, now: number): Rings => {
  const day = dayOf(now)
  return { day, today: (r.day === day ? r.today : 0) + 1, total: r.total + 1 }
}

export const ringsToday = (r: Rings, now: number) => (r.day === dayOf(now) ? r.today : 0)

function desk(c: Canvas, t: number, x: number) {
  rect(c, x, 12, 14, 1, WOOD)
  rect(c, x + 1, 13, 1, 2, WOOD); rect(c, x + 12, 13, 1, 2, WOOD)
  rect(c, x + 3, 7, 7, 4, 0x2a3140)  // the laptop's screen, lines of code scrolling on it
  for (let k = 0; k < 3; k++) {
    const w = 2 + Math.floor(((Math.floor(t / 400) + k * 3) % 5))
    rect(c, x + 4, 8 + k, Math.min(w, 5), 1, k === 1 ? mix(FOCUS, 0x2a3140, 0.3) : 0x6a7890)
  }
  rect(c, x + 2, 11, 9, 1, 0x4a5262)
}

function hammock(c: Canvas, t: number, x: number, w: number) {
  rect(c, x, 7, 1, 8, WOOD); rect(c, x + w, 7, 1, 8, WOOD)
  const sway = Math.sin(t / 900) * 0.6
  for (let i = 1; i < w; i++) put(c, x + i, 8 + Math.sin((i / w) * Math.PI) * 5 + sway, 0x7d6a9a)
}

function tree(c: Canvas, t: number, x: number, rings: number) {
  const h = Math.min(9, 3 + rings)
  rect(c, x, GROUND - h, 2, h, WOOD)
  const r = Math.min(5, 2 + Math.ceil(rings / 2))
  const cy = GROUND - h - 1
  const sway = Math.round(Math.sin(t / 1300))
  for (let j = -r; j <= r; j++) for (let i = -r - 1; i <= r + 2; i++) {
    if ((i - 0.5) ** 2 / (r + 1) ** 2 + j ** 2 / r ** 2 <= 1) put(c, x + i + (j < 0 ? sway : 0), cy + j, j < 0 ? LEAF : mix(LEAF, 0, 0.2))
  }
}

export function frame(timer: Pomo, rings: Rings, now: number, t: number, W: number): Uint32Array {
  const c = canvas(W)
  const g: Glyph[] = []
  ground(c)
  const today = ringsToday(rings, now)
  const tx = W - 12
  tree(c, t, tx, today)
  const ringText = `${today} ring${today === 1 ? '' : 's'} today`
  label(g, Math.max(0, tx - 8 - ringText.length), 0, ringText, today ? LEAF : DIM)

  const left = timer.endsAt - now
  if (timer.phase === 'focus') {
    clawd(c, t, 'type', 4, 1)
    desk(c, t, 16)
    label(g, 1, 0, `focus ${clock(left)}`, FOCUS)
    const done = 1 - left / Math.max(1, timer.endsAt - timer.startedAt)
    const bar = 24
    for (let i = 0; i < bar; i++) put(c, 34 + i, 1, i < done * bar ? FOCUS : 0x2a2d36)
    return cells(c, g)
  }
  if (timer.phase === 'break') {
    hammock(c, t, 6, 30)
    clawd(c, t, 'rest', 14, 1, 1, { eyes: 'closed', legs: false })
    hammock(c, t, 6, 30)  // again, over him: he lies in it, not on it
    for (let k = 0; k < 3; k++) {
      const life = ((t / 700) + k * 1.3) % 4
      label(g, 30 + k * 2 + Math.round(life), 3 - Math.floor(life), k === 2 ? 'Z' : 'z', mix(REST, 0x1b1b1e, life / 4))
    }
    label(g, 1, 0, `break ${clock(left)}`, REST)
    return cells(c, g)
  }
  clawd(c, t, 'stand', 4, 1)
  desk(c, 0, 20)
  label(g, 1, 0, 'idle', DIM)
  label(g, 40, 2, '/pomodawd start', TEXT)
  return cells(c, g)
}
