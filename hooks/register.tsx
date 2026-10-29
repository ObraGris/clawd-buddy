import { atom, read, update } from 'claude-code'
import type { Engine, Register, Timer } from 'claude-code'

import type { Mood } from '../types'

const mood = atom({ plugin: 'clawd-buddy', key: 'mood' } as const, 'hidden' as Mood)
// Seconds into the walk cycle where Clawd last stopped: every still pose draws him there, the next walk resumes from it.
const phase = atom({ plugin: 'clawd-buddy', key: 'phase' } as const, 0)

const IDLE_MS = 3000
const REACT_MS = 6000

// Clawd in 3px cells, 11 wide, on a 10-row canvas: rows 0-3 hold the z's, dots, hops and confetti.
const C = 3
const TOP = 4
const W = 180
const H = 10 * C
const RUN = W - 11 * C
const CYCLE = 7
const LOOK = 2 / 3 // how far the eyes shift toward the way he faces, in cells
const rect = (x: number, y: number, w: number, h: number) =>
  `M${x * C} ${(y + TOP) * C}h${w * C}v${h * C}h${-w * C}z`

const BODY = rect(2, 0, 7, 4)
const ARM_L = rect(0, 2, 2, 1)
const ARM_L_UP = rect(1, 1, 1, 1) + rect(0, 0, 1, 1)
const ARM_R = rect(9, 2, 2, 1)
const ARM_R_UP = rect(9, 1, 1, 1) + rect(10, 0, 1, 1)
const eyes = (d: number) => rect(3 + d, 1, 1, 1) + rect(7 + d, 1, 1, 1)
const eyesShut = (d: number) => rect(3 + d, 1.6, 1, 0.4) + rect(7 + d, 1.6, 1, 0.4)
const eyesX = (d: number) =>
  [3 + d, 7 + d].map(x => `M${x * C} ${(1 + TOP) * C}l${C} ${C}m0 ${-C}l${-C} ${C}`).join('')
const LEGS_A = [2, 4, 6, 8].map(x => rect(x, 4, 1, 2)).join('')
const LEGS_B = [3, 5, 7, 9].map(x => rect(x - 1, 4, 1, 1) + rect(x, 5, 1, 1)).join('')
const LEGS_SAT = [2, 4, 6, 8].map(x => rect(x, 4, 1, 1)).join('')

// Where the walk puts Clawd at `p` seconds: out in 45% of the cycle, a pause, back, a pause.
export function xAt(p: number) {
  const t = (((p % CYCLE) + CYCLE) % CYCLE) / CYCLE
  const x = t < 0.45 ? (RUN * t) / 0.45 : t < 0.5 ? RUN : t < 0.95 ? RUN * (1 - (t - 0.5) / 0.45) : 0
  return Math.round(x * 10) / 10
}

// +LOOK facing right (the way out), -LOOK facing left (the way back).
export const faceAt = (p: number) => ((((p % CYCLE) + CYCLE) % CYCLE) / CYCLE < 0.5 ? LOOK : -LOOK)

const ORANGE = '#D97757'
const INK = '#1f1e1d'
const svg = (body: string) =>
  `<svg xmlns="http://www.w3.org/2000/svg" width="${W}" height="${H}" viewBox="0 0 ${W} ${H}">` +
  `<style>:root{color-scheme:light dark}</style><g fill="${ORANGE}">${body}</g></svg>`
const at = (x: number, body: string) => `<g transform="translate(${x} 0)">${body}</g>`
const blink = `<animate attributeName="opacity" values="1;0;1" keyTimes="0;0.97;1" dur="4s" calcMode="discrete" repeatCount="indefinite"/>`
const flip = (from: 0 | 1, dur = 0.3) =>
  `<animate attributeName="opacity" values="${from};${1 - from}" dur="${dur}s" calcMode="discrete" repeatCount="indefinite"/>`

// Every source is built once per mood and the band redraws only when the mood changes, so a frame never reloads mid-animation.
// A negative begin starts the cycle `p` seconds in, so the walk picks up where Clawd stopped.
export const walkSvg = (p: number) =>
  svg(
    `<animateTransform attributeName="transform" type="translate" ` +
      `values="0 0;${RUN} 0;${RUN} 0;0 0;0 0" keyTimes="0;0.45;0.5;0.95;1" dur="${CYCLE}s" begin="${-p}s" repeatCount="indefinite"/>` +
      `<path d="${BODY}${ARM_L}${ARM_R}"/>` +
      `<path d="${LEGS_A}">${flip(1)}</path><path d="${LEGS_B}" opacity="0">${flip(0)}</path>` +
      `<path d="${eyes(0)}" fill="${INK}">${blink}` +
      `<animateTransform attributeName="transform" type="translate" values="${LOOK * C} 0;${-LOOK * C} 0" keyTimes="0;0.5" ` +
      `dur="${CYCLE}s" begin="${-p}s" calcMode="discrete" repeatCount="indefinite"/></path>`,
  )

const zee = (i: number) =>
  `<text x="${12 * C}" y="${4 * C}" font-family="monospace" font-size="${3 * C}" font-weight="bold" opacity="0">z` +
  `<animate attributeName="opacity" values="0;1;0" dur="3s" begin="${i}s" repeatCount="indefinite"/>` +
  `<animateTransform attributeName="transform" type="translate" values="0 0;${3 * C} ${-3 * C}" dur="3s" begin="${i}s" repeatCount="indefinite"/></text>`

export const sleepSvg = (x: number, d: number) =>
  svg(
    at(
      x,
      `<g transform="translate(0 ${C})"><g>` +
        `<animateTransform attributeName="transform" type="translate" values="0 0;0 1;0 0" dur="3s" repeatCount="indefinite"/>` +
        `<path d="${BODY}${ARM_L}${ARM_R}"/><path d="${eyesShut(d)}" fill="${INK}"/></g>` +
        `<path d="${LEGS_SAT}"/></g>` +
        [0, 1, 2].map(zee).join(''),
    ),
  )

// One hop and a wave as the turn starts (0-1.6s), then three dots that keep thinking.
const dot = (i: number) =>
  `<path d="${rect(3 + 2 * i, -2, 1, 1)}" opacity="0">` +
  `<animate attributeName="opacity" values="0;1;1;0" keyTimes="0;0.2;0.7;1" dur="1.5s" begin="${1.6 + 0.25 * i}s" repeatCount="indefinite"/></path>`

export const workSvg = (x: number, d: number) =>
  svg(
    at(
      x,
      `<g><animateTransform attributeName="transform" type="translate" values="0 0;0 ${-3 * C};0 0;0 ${-1.5 * C};0 0" ` +
        `keyTimes="0;0.25;0.5;0.75;1" dur="0.8s" fill="freeze"/>` +
        `<path d="${BODY}${ARM_L}"/>` +
        `<path d="${ARM_R}"><animate attributeName="opacity" values="1;0;1;0;1" keyTimes="0;0.5;0.625;0.75;0.875" dur="1.6s" calcMode="discrete" fill="freeze"/></path>` +
        `<path d="${ARM_R_UP}" opacity="0"><animate attributeName="opacity" values="0;1;0;1;0" keyTimes="0;0.5;0.625;0.75;0.875" dur="1.6s" calcMode="discrete" fill="freeze"/></path>` +
        `<path d="${LEGS_A}"/><path d="${eyes(d)}" fill="${INK}">${blink}</path></g>` +
        [0, 1, 2].map(dot).join(''),
    ),
  )

// The turn went well: bouncing, both claws pumping, confetti falling around him.
const CONFETTI = ['#D97757', '#1D9E75', '#BA7517', '#6A9BCC', '#E24B4A', '#1D9E75']
const confetto = (colour: string, i: number) =>
  `<rect x="${-6 + i * 9}" y="0" width="2" height="2" fill="${colour}" opacity="0">` +
  `<animate attributeName="opacity" values="0;1;1;0" keyTimes="0;0.1;0.8;1" dur="1.2s" begin="${(i * 0.37) % 1.2}s" repeatCount="indefinite"/>` +
  `<animateTransform attributeName="transform" type="translate" values="0 0;${i % 2 ? 3 : -3} ${H - 4}" dur="1.2s" begin="${(i * 0.37) % 1.2}s" repeatCount="indefinite"/></rect>`

export const partySvg = (x: number, d: number) =>
  svg(
    at(
      x,
      CONFETTI.map(confetto).join('') +
        `<g><animateTransform attributeName="transform" type="translate" values="0 0;0 ${-2 * C};0 0" dur="0.5s" repeatCount="indefinite"/>` +
        `<path d="${BODY}${LEGS_A}"/>` +
        `<path d="${ARM_L}${ARM_R_UP}">${flip(1, 0.5)}</path><path d="${ARM_L_UP}${ARM_R}" opacity="0">${flip(0, 0.5)}</path>` +
        `<path d="${eyes(d)}" fill="${INK}"/></g>`,
    ),
  )

// Something failed: three shakes, then slumped with X eyes and a sweat drop that keeps falling.
const SWEAT = '#6A9BCC'
export const oopsSvg = (x: number, d: number) =>
  svg(
    at(
      x,
      `<path d="M${10 * C} ${(TOP - 1) * C}l2 3a2 2 0 1 1 -4 0z" fill="${SWEAT}" opacity="0">` +
        `<animate attributeName="opacity" values="0;1;1;0" keyTimes="0;0.15;0.75;1" dur="1.4s" begin="0.6s" repeatCount="indefinite"/>` +
        `<animateTransform attributeName="transform" type="translate" values="0 0;1 ${2 * C}" dur="1.4s" begin="0.6s" repeatCount="indefinite"/></path>` +
        `<g><animateTransform attributeName="transform" type="translate" values="0 0;-3 0;3 0;-3 0;3 0;0 0" dur="0.5s" repeatCount="3" fill="freeze"/>` +
        `<g transform="translate(0 ${C})"><path d="${BODY}${ARM_L}${ARM_R}"/>` +
        `<path d="${eyesX(d)}" stroke="${INK}" stroke-width="1" fill="none"/></g>` +
        `<path d="${LEGS_SAT}" transform="translate(0 ${C})"/></g>`,
    ),
  )

let idle: Timer | undefined
let react: Timer | undefined
let walkStart = 0
let hasText = false
let bashFailed = false

// Compares with the stored mood, not a module variable, so a reload never leaves the two out of step.
async function set($: Engine, next: Mood) {
  const last = await read($, mood)
  if (next === last) return
  if (next === 'walk') {
    walkStart = (await $.clock.now()) - (await read($, phase)) * 1000
  } else if (last === 'walk') {
    const p = Math.round(((((await $.clock.now()) - walkStart) / 1000) % CYCLE) * 100) / 100
    await update($, phase, () => p)
  }
  await update($, mood, () => next)
}

// Any text in the box walks; a pause of IDLE_MS puts Clawd to sleep; an empty box hides him.
async function onDraft($: Engine, text: string) {
  idle?.cancel()
  hasText = text.trim() !== ''
  if (!hasText) {
    const last = await read($, mood)
    if (last === 'walk' || last === 'sleep') await set($, 'hidden')
    return
  }
  idle = $.clock.after(IDLE_MS, () => void set($, 'sleep'))
  await set($, 'walk')
}

// A reaction shows for REACT_MS, unless typing takes over first.
async function onTurnEnd($: Engine, next: 'party' | 'oops') {
  if ((await read($, mood)) === 'walk') return
  react?.cancel()
  react = $.clock.after(REACT_MS, () => void endReaction($))
  await set($, next)
}

async function endReaction($: Engine) {
  const m = await read($, mood)
  if (m === 'party' || m === 'oops') await set($, hasText ? 'sleep' : 'hidden')
}

export const register: Register = on => {
  on('prompt.edit', async ($, e, next) => {
    const r = await next(e)
    if (r.text !== e.text) await onDraft($, r.text)
    return r
  })

  on('prompt.change', async ($, e, next) => {
    await onDraft($, e.text)
    return next(e)
  })

  on('turn.start', async ($, e, next) => {
    if (e.agentId === undefined) {
      bashFailed = false
      // A reaction whose timer a reload dropped would otherwise stay up.
      await endReaction($)
    }
    return next(e)
  })

  // Only the turn's last command counts: a failure Claude went on to fix is not a failed turn.
  on('tool.call', { tool: 'Bash' }, async ($, e, next) => {
    const main = e.agentId === undefined
    try {
      const r = await next(e)
      if (main) bashFailed = r.isError === true
      return r
    } catch (err) {
      if (main) bashFailed = true
      throw err
    }
  })

  on('turn.complete', async ($, e, next) => {
    if (e.agentId === undefined && e.reason !== 'aborted') {
      await onTurnEnd($, e.reason === 'answer' && !bashFailed ? 'party' : 'oops')
    }
    return next(e)
  })

  on('ui.render', { component: 'AbovePrompt' }, async ($, e, next) => {
    const below = await next(e).catch(() => null)
    const m = await read($, mood)
    const p = await read($, phase)
    if (e.props.hasSurvey) return below

    if (e.surface === 'desktop') {
      const x = xAt(p)
      const d = faceAt(p)
      const source =
        m === 'walk' ? walkSvg(p)
        : e.props.isWorking ? workSvg(x, d)
        : m === 'party' ? partySvg(x, d)
        : m === 'oops' ? oopsSvg(x, d)
        : m === 'sleep' ? sleepSvg(x, d)
        : null
      if (source === null) return below
      const { Box, Svg } = $.ui.resolve(e)
      return (
        <Box flexDirection="column">
          {below}
          <Svg source={source} alt="Clawd" width={W} height={H} isInteractive />
        </Box>
      )
    }

    if (m !== 'walk' && m !== 'sleep') return below
    const { Box, Text } = $.ui.resolve(e)
    return (
      <Box flexDirection="column" paddingRight={4}>
        {below}
        <Text color="claude"> ▐▛███▜▌</Text>
        <Text color="claude">▝▜█████▛▘</Text>
        <Text color="claude">  ▘▘ ▝▝</Text>
      </Box>
    )
  })
}
