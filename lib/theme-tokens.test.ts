/* The palette lives in two token blocks in app/globals.css. Nothing enforces
   that they stay in step, and when they don't the failure is silent: a plate
   defined only in `:root` keeps its light value under `.theme-dark`, so a row
   renders pale with white text on it. That is exactly how the vacancy urgency
   rows shipped once — 1.06:1, unreadable — while every screen the sweep
   happened to visit came back clean. These tests read the stylesheet itself. */
import test from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'

const css = readFileSync(new URL('../app/globals.css', import.meta.url), 'utf8')
const slice = (from: string, to: string) => css.slice(css.indexOf(from), css.indexOf(to, css.indexOf(from)))
const declarations = (block: string) => {
  const out = new Map<string, string>()
  for (const m of block.matchAll(/(--[a-z0-9-]+):\s*([^;]+);/g)) out.set(m[1], m[2].trim())
  return out
}

const light = declarations(slice(':root {', '.theme-dark {'))
const dark = declarations(slice('.theme-dark {', '@theme inline'))

/* Geometry and the brand marks are the same in both themes on purpose. */
const themeNeutral = /^--(space|text|r|radius|brand)/

const luminance = (hex: string) => {
  let h = hex.replace('#', '')
  if (h.length === 3) h = [...h].map(c => c + c).join('')
  if (h.length < 6) return null
  const channel = (v: number) => (v <= 0.03928 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4)
  const [r, g, b] = [0, 2, 4].map(i => channel(parseInt(h.slice(i, i + 2), 16) / 255))
  return 0.2126 * r + 0.7152 * g + 0.0722 * b
}

test('no light literal survives into the dark theme', () => {
  const leaked: string[] = []
  for (const [name, value] of light) {
    if (themeNeutral.test(name) || dark.has(name)) continue
    if (!value.startsWith('#')) continue        // an alias resolves per theme
    const l = luminance(value)
    if (l !== null && l > 0.5) leaked.push(`${name}: ${value}`)
  }
  assert.deepEqual(leaked, [], `light values with no .theme-dark override:\n${leaked.join('\n')}`)
})

test('every tone has a plate, a hairline and ink in both themes', () => {
  for (const tone of ['info', 'ok', 'warn', 'danger', 'alt', 'alt2'])
    for (const part of ['plate', 'line', 'ink'])
      for (const [theme, block] of [['light', light], ['dark', dark]] as const)
        assert.ok(block.has(`--tone-${tone}-${part}`), `${theme} is missing --tone-${tone}-${part}`)
})

test('tone ink clears 4.5:1 on its own plate in both themes', () => {
  const contrast = (a: string, b: string) => {
    const [x, y] = [luminance(a)!, luminance(b)!].sort((p, q) => q - p)
    return (x + 0.05) / (y + 0.05)
  }
  for (const [theme, block] of [['light', light], ['dark', dark]] as const)
    for (const tone of ['info', 'ok', 'warn', 'danger', 'alt', 'alt2']) {
      const ratio = contrast(block.get(`--tone-${tone}-ink`)!, block.get(`--tone-${tone}-plate`)!)
      assert.ok(ratio >= 4.5, `${theme} ${tone}: ${ratio.toFixed(2)}:1 is under the 4.5:1 floor`)
    }
})

test('the CTA label is readable on the CTA plate in both themes', () => {
  const contrast = (a: string, b: string) => {
    const [x, y] = [luminance(a)!, luminance(b)!].sort((p, q) => q - p)
    return (x + 0.05) / (y + 0.05)
  }
  for (const [theme, block] of [['light', light], ['dark', dark]] as const) {
    const ink = block.get('--primary-foreground') ?? light.get('--primary-foreground')!
    const plate = block.get('--primary') ?? light.get('--primary')!
    const ratio = contrast(ink, plate)
    assert.ok(ratio >= 4.5, `${theme} CTA: ${ratio.toFixed(2)}:1 (${ink} on ${plate})`)
  }
})

test('rules carry no raw colour except neutral scrims and shadows', () => {
  const rules = css.slice(css.indexOf('* { box-sizing'))
  const offenders = [...rules.matchAll(/#[0-9a-fA-F]{3,8}\b/g)].map(m => m[0].toLowerCase())
  /* Black- and slate-alpha overlays read correctly against either theme. */
  const neutral = /^#(0{3,6}[0-9a-f]{0,2}|101820[0-9a-f]{2})$/
  assert.deepEqual(offenders.filter(c => !neutral.test(c)), [],
    'these belong in the palette blocks, not in a rule')
})

/* `opacity` is the one property that can break contrast invisibly: a checker
   reading getComputedStyle().color gets the colour before compositing, so text
   under a dimmed ancestor measures as if it were fully opaque. Three separate
   rules had drifted under the floor this way — the calendar's other-month days
   at 2.12:1, a finished task's badge at 3.06:1, and the urgency badge's pulse
   at 4.45:1 — while an in-house sweep reported all of them clean. Anything
   dimmer than --dim has to say why here. */
test('nothing containing text is dimmed below the verified level', () => {
  const dim = Number(/--dim:\s*([\d.]+)/.exec(css)?.[1])
  assert.ok(dim > 0, '--dim is not defined')

  /* Disabled controls sit outside WCAG 1.4.3, and a drag ghost or a decorative
     grid carries no text to read. */
  const exempt = [':disabled', '[disabled]', 'is-dragging', 'map-gridlines', 'scrim', 'backdrop']
  const offenders: string[] = []
  for (const m of css.matchAll(/([^{}]+)\{([^{}]*)\}/g)) {
    const selector = m[1].replace(/\/\*[\s\S]*?\*\//g, '').trim().replace(/\s+/g, ' ')
    if (!selector || selector.startsWith('@') || selector.startsWith(':root') || selector.startsWith('.theme-')) continue
    if (exempt.some(e => selector.includes(e))) continue
    for (const o of m[2].matchAll(/(?:^|;)\s*opacity:\s*([\d.]+)/g)) {
      const value = Number(o[1])
      if (value < dim && value > 0) offenders.push(`${selector.slice(0, 60)} { opacity: ${value} }`)
    }
  }
  assert.deepEqual(offenders, [],
    `dimmer than --dim (${dim}); either raise it or add the selector to the exempt list:\n${offenders.join('\n')}`)
})
