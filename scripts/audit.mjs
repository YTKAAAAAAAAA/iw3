/* Visual and accessibility sweep over every route, both themes, three widths.
 *
 *   AUDIT_PASSWORD=… node scripts/audit.mjs                       # local server on :3000
 *   AUDIT_PASSWORD=… node scripts/audit.mjs https://staging.example  # anywhere else
 *
 * It signs in with AUDIT_PASSWORD, then visits every screen. Person and
 * vacancy pages are taken from the first entries of the live lists, so the
 * sweep works against real data instead of fixed prototype IDs. Set
 * AUDIT_BROWSER_CHANNEL=chrome to use an installed Chrome instead of
 * Playwright's own Chromium.
 *
 * Two engines run on each page:
 *
 *   axe-core — the industry rule set. It composites colour properly, which is
 *   the reason it belongs here: a hand-rolled check reads
 *   getComputedStyle().color and gets the *unblended* value, so text under an
 *   `opacity: .45` ancestor measures as if it were fully opaque. That is how
 *   the calendar's other-month days passed an in-house sweep at a claimed
 *   7.58:1 while actually rendering at 2.12:1.
 *
 *   The local checks — things axe has no opinion about because they are this
 *   product's own rules: the 4pt spacing scale, the type scale, near-miss edge
 *   alignment, and pointer targets under the 24px floor.
 */
import { chromium } from 'playwright'
import { readFileSync } from 'node:fs'
import { createRequire } from 'node:module'

const require = createRequire(import.meta.url)
const axeSource = readFileSync(require.resolve('axe-core/axe.min.js'), 'utf8')

const BASE = (process.argv[2] ?? 'http://localhost:3000').replace(/\/+$/, '')
const PASSWORD = process.env.AUDIT_PASSWORD
if (!PASSWORD) throw new Error('Set AUDIT_PASSWORD to the dispatcher password of the instance being audited.')
const STATIC_ROUTES = ['/', '/people', '/people?status=dismissed', '/vacancies', '/vacancies/new', '/hours',
                       '/companies', '/map', '/sync', '/settings/password', '/this-page-does-not-exist']
const THEMES = ['light', 'dark']
const WIDTHS = [[1440, 900], [768, 1024], [375, 812]]

/* The scale every padding, margin and gap in globals.css is meant to land on. */
const SPACE = [0, 1, 2, 4, 8, 12, 16, 20, 24, 28, 32, 36, 40, 48, 60]
const TYPE = [11, 12, 13, 14, 16, 20, 24]

const localChecks = () => {
  const SPACE_SCALE = new Set(SPACE_IN)
  const TYPE_SCALE = new Set(TYPE_IN)
  const px = v => Math.round(parseFloat(v) || 0)
  const seen = (r, e) => r.width > 2 && r.height > 2 && getComputedStyle(e).visibility !== 'hidden'
  const label = e => {
    const c = (e.className && (e.className.baseVal ?? e.className)) || ''
    return e.tagName.toLowerCase() + (c ? '.' + c.toString().trim().split(/\s+/).slice(0, 2).join('.') : '')
  }
  const all = [...document.querySelectorAll('body *')]
    .filter(e => !['PATH', 'LINE', 'CIRCLE', 'RECT', 'POLYLINE', 'POLYGON', 'G', 'DEFS', 'SVG'].includes(e.tagName.toUpperCase()))
    /* Leaflet's attribution and zoom controls are the library's markup, not
       ours; flagging their 5px padding every run trains you to skip the list. */
    .filter(e => !e.closest('.leaflet-control-container, .leaflet-pane, nextjs-portal'))
    .filter(e => seen(e.getBoundingClientRect(), e))

  const offGrid = new Map(), offType = new Map(), tiny = new Map(), spill = new Map()
  for (const e of all) {
    const c = getComputedStyle(e)
    for (const prop of ['paddingTop', 'paddingRight', 'paddingBottom', 'paddingLeft', 'gap', 'rowGap', 'columnGap']) {
      const v = c[prop]
      if (!v || v === 'normal' || v.includes('%')) continue
      const n = px(v)
      if (!SPACE_SCALE.has(n)) offGrid.set(`${label(e)} {${prop}: ${n}px}`, (offGrid.get(`${label(e)} {${prop}: ${n}px}`) || 0) + 1)
    }
    const size = Math.round(parseFloat(c.fontSize))
    if (size && !TYPE_SCALE.has(size) && (e.textContent || '').trim())
      offType.set(`${label(e)} @${size}px`, (offType.get(`${label(e)} @${size}px`) || 0) + 1)

    const r = e.getBoundingClientRect()
    if ((e.tagName === 'BUTTON' || e.tagName === 'A') && (r.width < 24 || r.height < 24) && !e.closest('[aria-hidden="true"]'))
      tiny.set(`${label(e)} ${Math.round(r.width)}×${Math.round(r.height)}`, 1)

    const parent = e.parentElement
    if (parent && seen(parent.getBoundingClientRect(), parent) && getComputedStyle(parent).overflow === 'visible') {
      const pr = parent.getBoundingClientRect()
      if (r.right - pr.right > 1.5) spill.set(`${label(e)} выходит на ${Math.round(r.right - pr.right)}px за ${label(parent)}`, 1)
    }
  }

  /* Siblings whose left edges sit 2-3px apart read as crooked — close enough to
     look intentional, far enough to look wrong. Only siblings: two elements in
     unrelated corners of the page sharing an x is a coincidence, not a defect,
     and reporting those buries the real ones. */
  const nearMiss = new Set()
  for (const parent of new Set(all.map(e => e.parentElement).filter(Boolean))) {
    const kids = [...parent.children].filter(e => all.includes(e))
    if (kids.length < 2) continue
    /* Centred children of different widths have different left edges by
       construction — that is what centring means, not a misalignment. */
    const justify = getComputedStyle(parent)
    if (/center/.test(justify.justifyContent) || /center/.test(justify.alignItems) ||
        /center/.test(justify.placeItems) || justify.textAlign === 'center') continue
    const byEdge = new Map()
    for (const k of kids) {
      const x = Math.round(k.getBoundingClientRect().left)
      byEdge.set(x, [...(byEdge.get(x) ?? []), label(k)])
    }
    const xs = [...byEdge.keys()].sort((a, b) => a - b)
    for (let i = 0; i < xs.length - 1; i++) {
      const d = xs[i + 1] - xs[i]
      if (d > 1 && d <= 3)
        nearMiss.add(`${d}px внутри ${label(parent)}: ${byEdge.get(xs[i])[0]} / ${byEdge.get(xs[i + 1])[0]}`)
    }
  }

  const top = m => [...m.entries()].sort((a, b) => b[1] - a[1]).map(([k]) => k)
  return { offGrid: top(offGrid), offType: top(offType), tiny: top(tiny), spill: top(spill), nearMiss: [...nearMiss] }
}

const browser = await chromium.launch(process.env.AUDIT_BROWSER_CHANNEL ? { channel: process.env.AUDIT_BROWSER_CHANNEL } : {})

async function signIn(context) {
  const page = await context.newPage()
  await page.goto(`${BASE}/login`)
  await page.fill('input[type=password]', PASSWORD)
  await Promise.all([page.waitForURL(url => !url.pathname.startsWith('/login'), { timeout: 30000 }), page.click('button[type=submit]')])
  return page
}

/* One real person and one real vacancy, read from the lists. */
async function detailRoutes(page) {
  await page.goto(`${BASE}/people`, { waitUntil: 'networkidle' })
  const person = await page.locator('a.person-cell').first().getAttribute('href').catch(() => null)
  await page.goto(`${BASE}/vacancies`, { waitUntil: 'networkidle' })
  const vacancy = await page.locator('a[href^="/vacancies/"]:not([href="/vacancies/new"])').first().getAttribute('href').catch(() => null)
  return [person, vacancy].filter(Boolean)
}
const axeFindings = new Map()
const localFindings = new Map()
let checked = 0

const note = (map, key, where) => {
  const e = map.get(key) ?? new Set()
  e.add(where)
  map.set(key, e)
}

for (const theme of THEMES) {
  const context = await browser.newContext({ viewport: { width: WIDTHS[0][0], height: WIDTHS[0][1] } })
  await context.addInitScript(t => { try { localStorage.setItem('iatw-theme', t) } catch {} }, theme)
  const page = await signIn(context)
  const ROUTES = [...STATIC_ROUTES, ...await detailRoutes(page)]

  for (const route of ROUTES) {
    for (const [width, height] of WIDTHS) {
      await page.setViewportSize({ width, height })
      try { await page.goto(BASE + route, { waitUntil: 'networkidle', timeout: 30000 }) }
      catch { console.error(`  пропущено: ${theme} ${route} ${width}px`); continue }
      const where = `${theme} ${route} ${width}px`
      checked++

      /* axe only at the widest size — its rules do not change with viewport,
         and running it three times per route triples the sweep for nothing. */
      if (width === WIDTHS[0][0]) {
        await page.addScriptTag({ content: axeSource })
        const { violations } = await page.evaluate(async () =>
          await window.axe.run(document, { resultTypes: ['violations'] }))
        for (const v of violations)
          note(axeFindings, `[${v.impact ?? 'n/a'}] ${v.id} — ${v.help}`, where)
      }

      const local = await page.evaluate(
        ({ fn, space, type }) => new Function('SPACE_IN', 'TYPE_IN', `return (${fn})()`)(space, type),
        { fn: localChecks.toString(), space: SPACE, type: TYPE })
      for (const [group, items] of Object.entries(local))
        for (const item of items) note(localFindings, `${group}: ${item}`, where)
    }
  }
  await context.close()
}
await browser.close()

const report = (title, map) => {
  console.log(`\n${title}`)
  if (!map.size) { console.log('  чисто'); return }
  const rank = { critical: 0, serious: 1, moderate: 2, minor: 3 }
  const rows = [...map.entries()].sort((a, b) => {
    const [ia] = a[0].match(/\[(\w+)\]/)?.slice(1) ?? ['zz']
    const [ib] = b[0].match(/\[(\w+)\]/)?.slice(1) ?? ['zz']
    return (rank[ia] ?? 9) - (rank[ib] ?? 9) || b[1].size - a[1].size
  })
  for (const [key, where] of rows)
    console.log(`  ${key}\n      ${where.size} стр., напр. ${[...where][0]}`)
}

console.log(`Проверено ${checked} страниц · ${BASE}`)
report('— axe-core —', axeFindings)
report('— правила этого продукта —', localFindings)
const total = axeFindings.size + localFindings.size
console.log(`\nвсего видов проблем: ${total}`)
process.exit(total ? 1 : 0)
