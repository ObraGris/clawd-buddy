import { expect, test } from 'claude-code/testing'

import { faceAt, oopsSvg, partySvg, sleepSvg, walkSvg, widthFor, workSvg, xAt } from './register'

const BAND = {
  plugin: 'clawd-buddy',
  component: 'AbovePrompt',
  props: {
    hasSurvey: false,
    isWorking: false,
    maxRows: 20,
    bodyColumns: 20,
    scroll: { offset: 0, bodyRows: 19 },
    view: {},
  },
} as const

const seed = (on: any, mood: string, phase = 0) =>
  on('state.get', (_: unknown, e: { key: string }) => ({
    value: { value: e.key === 'phase' ? phase : mood, version: 1 },
  }))

const desktopSource = async ($: any, props = {}) => {
  const ui = await $.ui.mount({ ...BAND, surface: 'desktop', props: { ...BAND.props, ...props } })
  const svgs = await ui.findAll({ type: 'Svg' })
  await ui.unmount()
  expect(svgs.length).toBe(1)
  return svgs[0].props.source
}

test('the walk path goes out, pauses, comes back', () => {
  expect(xAt(0)).toBe(0)
  expect(xAt(0.45)).toBe(147)
  expect(xAt(0.47)).toBe(147)
  expect(xAt(0.725)).toBe(73.5)
  expect(xAt(0.99)).toBe(0)
  expect(xAt(1.225)).toBe(73.5)
  expect(xAt(0.45, 700)).toBe(667)
})

test('Clawd faces the way he walks', () => {
  expect(faceAt(0.2)).toBeGreaterThan(0)
  expect(faceAt(0.48)).toBeGreaterThan(0)
  expect(faceAt(0.6)).toBeLessThan(0)
  expect(faceAt(0.99)).toBeLessThan(0)
})

test('typing walks from where Clawd stopped', async ($, on) => {
  seed(on, 'walk', 0.25)
  const source = await desktopSource($)
  expect(source).toBe(walkSvg(0.25))
  expect(source).toContain('begin="-1.75s"')
  expect(await desktopSource($, { isWorking: true })).toBe(walkSvg(0.25))
})

test('a wide band gives Clawd the whole width at the same speed', async ($, on) => {
  seed(on, 'walk', 0)
  expect(widthFor(100)).toBe(700)
  const source = await desktopSource($, { bodyColumns: 100 })
  expect(source).toBe(walkSvg(0, 700))
  expect(source).toContain('width="700"')
  expect(source).toContain('dur="31.76s"')
})

test('a pause sleeps where the walk stopped, facing the same way', async ($, on) => {
  seed(on, 'sleep', 0.725)
  const source = await desktopSource($)
  expect(source).toBe(sleepSvg(73.5, faceAt(0.725)))
  expect(source).toContain('translate(73.5 0)')
  expect(source).toContain('<title>Clawd is napping')
})

test('a running turn thinks where Clawd stopped, even with an empty box', async ($, on) => {
  seed(on, 'hidden', 0.225)
  expect(await desktopSource($, { isWorking: true })).toBe(workSvg(73.5, faceAt(0.225)))
})

test('a running turn wakes a sleeping crab', async ($, on) => {
  seed(on, 'sleep')
  expect(await desktopSource($, { isWorking: true })).toBe(workSvg(0, faceAt(0)))
})

test('a good turn parties where Clawd stood', async ($, on) => {
  seed(on, 'party', 0.225)
  expect(await desktopSource($)).toBe(partySvg(73.5, faceAt(0.225)))
})

test('a failed turn slumps where Clawd stood', async ($, on) => {
  seed(on, 'oops', 0.225)
  expect(await desktopSource($)).toBe(oopsSvg(73.5, faceAt(0.225)))
})

test('the terminal keeps the still crab while there is text, and skips reactions', async ($, on) => {
  seed(on, 'sleep')
  const ui = await $.ui.mount({ ...BAND, surface: 'terminal' })
  expect(await ui.find({ type: 'Text', text: /▐▛███▜▌/ })).toBeDefined()
  await ui.unmount()
})

test('the terminal draws nothing for a reaction', async ($, on) => {
  seed(on, 'party')
  await expect($.ui.mount({ ...BAND, surface: 'terminal' })).rejects.toThrow()
})

test('an empty box with no turn draws nothing', async ($, on) => {
  seed(on, 'hidden')
  for (const surface of ['terminal', 'desktop'] as const) {
    await expect($.ui.mount({ ...BAND, surface })).rejects.toThrow()
  }
})

test('a survey takes the band', async ($, on) => {
  seed(on, 'walk')
  for (const surface of ['terminal', 'desktop'] as const) {
    await expect(
      $.ui.mount({ ...BAND, surface, props: { ...BAND.props, hasSurvey: true, isWorking: true } }),
    ).rejects.toThrow()
  }
})

test('a fresh session starts with Clawd asleep instead of hidden', async $ => {
  expect(await desktopSource($)).toBe(sleepSvg(0, faceAt(0)))
})

