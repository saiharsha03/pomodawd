import { atom, read, update } from 'claude-code'
import type { EngineInterface, Register } from 'claude-code'

import { encode, ROWS } from './art'
import { addRing, BREAK_MS, clock, FOCUS_MS, frame, IDLE, NO_RINGS, ringsToday } from './scene'
import type { Rings, Pomo } from '../types'

const FRAME_MS = 150
const EDGE = 2
const timer = atom({ plugin: 'pomodawd', key: 'timer' } as const, IDLE)
const rings = atom({ plugin: 'pomodawd', key: 'rings' } as const, NO_RINGS)
const shown = atom({ plugin: 'pomodawd', key: 'shown' } as const, false)

/** The band's mount, for blits between redraws. Module state: a reload starts over. */
const band = { mount: null as { requestId: string; columns: number } | null, last: '', blit: true, startedAt: 0 }

async function setTimer($: EngineInterface, next: Pomo) {
  await update($, timer, () => next)
  await $.store.set('timer', next)
}

async function start($: EngineInterface, phase: 'focus' | 'break', ms: number) {
  const now = await $.clock.now()
  await setTimer($, { phase, startedAt: now, endsAt: now + ms })
}

/** Once a second: the status line, and a phase that ran out moves on. */
async function tick($: EngineInterface) {
  const t = await read($, timer)
  if (t.phase === 'idle') {
    $.ui.status(undefined)
    return
  }
  const now = await $.clock.now()
  if (now < t.endsAt) {
    $.ui.status(`${t.phase} ${clock(t.endsAt - now)}`)
    return
  }
  if (t.phase === 'focus') {
    const r = addRing(await read($, rings), now)
    await update($, rings, () => r)
    await $.store.set('rings', r)
    await start($, 'break', BREAK_MS)
    $.ui.toast(`Pomodawd: focus done, ring ${r.today} today. Clawd's in the hammock for 5 min.`, { timeoutMs: 8000 })
    return
  }
  await setTimer($, IDLE)
  $.ui.status(undefined)
  $.ui.toast('Pomodawd: break over. /pomodawd start for another round.', { timeoutMs: 8000 })
}

async function paint($: EngineInterface) {
  const m = band.mount
  if (!m || !(await read($, shown))) return
  const now = await $.clock.now()
  const cells = encode(frame(await read($, timer), await read($, rings), now, now - band.startedAt, m.columns))
  if (cells === band.last || !band.blit) return
  band.last = cells
  const r = await $.ui.blit({ requestId: m.requestId, key: 'pomo', cells })
  if ('deny' in r && r.deny) {
    band.blit = false
    $.ui.invalidate('ui.render')
  }
}

export const register: Register = hook => {
  hook('session.start', async ($, e, next) => {
    band.startedAt = await $.clock.now()
    await $.command.register({
      name: 'pomodawd',
      description: 'Focus timer with Clawd: start [minutes] | break | stop; alone, show or hide it',
      argumentHint: '[start [min] | break | stop]',
      immediate: true,
    })
    // A timer running in another session (or before a reload) carries on here.
    const savedTimer = (await $.store.get('timer')) as Pomo | undefined
    const savedRings = (await $.store.get('rings')) as Rings | undefined
    if (savedTimer) await update($, timer, () => savedTimer)
    if (savedRings) await update($, rings, () => savedRings)
    $.clock.every(1000, () => void tick($))
    if (e.isInteractive) $.clock.every(FRAME_MS, () => void paint($))
    return next(e)
  })

  hook('command.run', { command: 'pomodawd' }, async ($, e) => {
    const [verb = '', arg = ''] = e.args.trim().toLowerCase().split(/\s+/)
    if (verb === 'start' || verb === 'focus') {
      const minutes = Number(arg) > 0 ? Math.min(180, Number(arg)) : FOCUS_MS / 60_000
      await start($, 'focus', minutes * 60_000)
      await update($, shown, () => true)
      return { text: `Pomodawd: focus for ${minutes} min. Clawd's at the desk.` }
    }
    if (verb === 'break') {
      await start($, 'break', BREAK_MS)
      await update($, shown, () => true)
      return { text: 'Pomodawd: break for 5 min.' }
    }
    if (verb === 'stop') {
      await setTimer($, IDLE)
      $.ui.status(undefined)
      return { text: 'Pomodawd: stopped. No ring for an unfinished session.' }
    }
    if (verb) return { text: 'Pomodawd: /pomodawd start [minutes] | break | stop, or /pomodawd alone to show or hide.' }
    const now = !(await read($, shown))
    await update($, shown, () => now)
    const today = ringsToday(await read($, rings), await $.clock.now())
    return { text: now ? `Pomodawd: on. ${today} ring${today === 1 ? '' : 's'} today.` : 'Pomodawd: hidden (the timer keeps running).' }
  })

  hook('ui.render', { component: 'AbovePrompt' }, async ($, e, next) => {
    const columns = e.props.bodyColumns - EDGE
    if (e.props.hasSurvey || e.surface !== 'terminal' || columns < 60 || !(await read($, shown))) {
      band.mount = null
      return next(e)
    }
    const { Raster, Box } = $.ui.resolve(e)
    const now = await $.clock.now()
    if (band.mount?.requestId !== e.requestId) band.blit = true
    band.mount = { requestId: e.requestId, columns }
    const cells = encode(frame(await read($, timer), await read($, rings), now, now - band.startedAt, columns))
    band.last = cells
    const below = await next(e)
    return (
      <Box flexDirection="column">
        <Raster key="pomo" columns={columns} rows={ROWS} cells={cells} />
        {below}
      </Box>
    )
  })
}
