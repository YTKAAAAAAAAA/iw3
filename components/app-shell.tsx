'use client'
import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { useEffect, useId, useRef, useState } from 'react'
import {
  BriefcaseBusiness,
  CalendarDays,
  ChevronRight,
  Clock3,
  Command,
  KeyRound,
  LayoutDashboard,
  LogOut,
  Map,
  Menu,
  Moon,
  PanelLeft,
  Plus,
  Search,
  Settings,
  Sun,
  Users,
  X,
} from 'lucide-react'
import { formatDate, parseClock } from '@/lib/types'
import type { ReactNode } from 'react'
import { BrandLockup } from './logo'
import { SearchDialog } from './search-dialog'
import { SyncStatusButton } from './sync-status-button'
import { logout } from '@/lib/auth/actions'
import { useLanguage } from '@/lib/i18n'

const nav = [
  ['Overview', '/', LayoutDashboard],
  ['People', '/people', Users],
  ['Vacancies', '/vacancies', BriefcaseBusiness],
  ['Hours', '/hours', Clock3],
  ['Companies', '/companies', Settings],
  ['Map', '/map', Map],
] as const
export function Badge({ children, tone = 'neutral' }: { children: ReactNode; tone?: string }) {
  const { t } = useLanguage()
  return (
    <span className={`badge badge-${tone}`}>{typeof children === 'string' ? t(children) : children}</span>
  )
}
export function Panel({ children, className = '' }: { children: ReactNode; className?: string }) {
  return <section className={`panel ${className}`}>{children}</section>
}
export function StateBlock({
  kind = 'empty',
  title,
  description,
  action,
}: {
  kind?: 'loading' | 'error' | 'empty'
  title: string
  description?: string
  action?: ReactNode
}) {
  const { t } = useLanguage()
  return (
    <div className={`state-block ${kind}`}>
      <div className="state-icon">{kind === 'loading' ? '…' : kind === 'error' ? '!' : '—'}</div>
      <strong>{t(title)}</strong>
      {description && <p>{t(description)}</p>}
      {action}
    </div>
  )
}
export function PageHeading({
  eyebrow,
  title,
  description,
  action,
}: {
  eyebrow: string
  title: string
  description: string
  action?: ReactNode
}) {
  const { t } = useLanguage()
  return (
    <div className="page-heading">
      <div>
        <p className="eyebrow">{t(eyebrow)}</p>
        <h1>{t(title)}</h1>
        <p className="subheading">{t(description)}</p>
      </div>
      {action}
    </div>
  )
}
/* ------------------------------------------------------------------
   The chosen theme.

   It used to be AppShell's own useState, and every page mounts its own
   AppShell — so opening another tab threw the choice away and the workspace
   snapped back to dark. A preference outlives the screen that set it, so it
   lives outside the React tree: one module-level value, mirrored into
   localStorage so it also survives a reload, and every mounted shell
   subscribes to it.
   ------------------------------------------------------------------ */
type Theme = 'dark' | 'light'
const THEME_KEY = 'iaw-theme'
let themeValue: Theme = 'dark'
const themeSubscribers = new Set<(theme: Theme) => void>()
const publishTheme = (next: Theme) => {
  themeValue = next
  themeSubscribers.forEach(fn => fn(next))
}

function useThemeSetting() {
  const [theme, setTheme] = useState<Theme>(themeValue)
  /* Whether the stored choice has been read yet. Until it has, the class
     painted by the layout's blocking script is the only truth about this
     browser's theme, and React must not contradict it. */
  const [adopted, setAdopted] = useState(false)
  /* The colours live on <html>, set by the inline script in the layout before
     the first paint and kept in step here. Keeping them on the shell's own
     div would repaint only after hydration — and would leave the page behind
     the shell in the other theme. */
  useEffect(() => {
    /* Skipped until the stored choice is in. `themeValue` starts at 'dark'
       because the server has to render something, so without this guard the
       first pass repainted a stored-light page dark and the effect below
       flipped it back one tick later — a dark flash on every page load. */
    if (!adopted) return
    document.documentElement.classList.toggle('theme-dark', theme === 'dark')
    document.documentElement.classList.toggle('theme-light', theme === 'light')
  }, [theme, adopted])
  useEffect(() => {
    themeSubscribers.add(setTheme)
    /* Read the stored choice after mounting, never during render: the server
       rendered the default, and adopting a different one mid-render is a
       hydration mismatch. */
    let stored: string | null = null
    try {
      stored = window.localStorage.getItem(THEME_KEY)
    } catch {
      stored = null
    }
    if (stored === 'dark' || stored === 'light') {
      if (stored !== themeValue) publishTheme(stored)
      else setTheme(themeValue)
      setAdopted(true)
      return () => {
        themeSubscribers.delete(setTheme)
      }
    }
    /* Nobody has chosen: follow the system rather than imposing an appearance.
       Somebody working on a light desktop all day should not be handed a dark
       app because the mock happened to be drawn dark — the in-app switch is an
       override, not the source of truth. */
    const system = window.matchMedia('(prefers-color-scheme: dark)')
    const adopt = () => {
      let saved: string | null = null
      try {
        saved = window.localStorage.getItem(THEME_KEY)
      } catch {
        saved = null
      }
      if (saved !== 'dark' && saved !== 'light') publishTheme(system.matches ? 'dark' : 'light')
    }
    adopt()
    setAdopted(true)
    system.addEventListener('change', adopt)
    return () => {
      system.removeEventListener('change', adopt)
      themeSubscribers.delete(setTheme)
    }
  }, [])
  const choose = (next: Theme) => {
    try {
      window.localStorage.setItem(THEME_KEY, next)
    } catch {
      /* private window — the choice still holds for this session */
    }
    publishTheme(next)
  }
  return [theme, choose] as const
}

/** A 24-hour time box.
 *
 *  Deliberately not <input type="time">: Chrome renders that in the browser's
 *  locale, so an English-language laptop offers an AM/PM stepper for a
 *  06:30 warehouse start. Typing is also simply faster — '630' is a time.
 *  What is typed is normalised when the field is left, and anything
 *  unreadable clears rather than guessing. */
export function TimeField({
  value,
  onChange,
  label,
  className = '',
}: {
  value: string | null
  onChange: (value: string | null) => void
  label: string
  className?: string
}) {
  const [text, setText] = useState(value ?? '')
  useEffect(() => {
    setText(value ?? '')
  }, [value])
  const commit = () => {
    const parsed = parseClock(text)
    setText(parsed ?? '')
    if (parsed !== value) onChange(parsed)
  }
  return (
    <input
      className={`time-field ${className}`}
      inputMode="numeric"
      placeholder="--:--"
      aria-label={label}
      value={text}
      onChange={e => setText(e.target.value)}
      onBlur={commit}
      onKeyDown={e => {
        if (e.key === 'Enter') (e.target as HTMLInputElement).blur()
      }}
    />
  )
}

/* ------------------------------------------------------------------
   Leaving.

   React takes a closed dialog out of the DOM on the spot, so there is
   nothing left to animate — an exit has to be asked for first and the
   unmount deferred until it has played. 150ms against the 200ms entrance:
   leaving should be quicker than arriving, or the interface feels reluctant
   to let go of a decision the user has already made.
   ------------------------------------------------------------------ */
export const EXIT_MS = 150
export function useExit(done: () => void) {
  const [closing, setClosing] = useState(false)
  const timer = useRef<number | undefined>(undefined)
  useEffect(() => () => window.clearTimeout(timer.current), [])
  const close = () => {
    if (closing) return /* a second click must not queue a second unmount */
    setClosing(true)
    /* Reset as well as finish: a dialog whose parent stays mounted (the
       company editor closes by clearing its own state) would otherwise
       reopen already wearing the leaving class. */
    timer.current = window.setTimeout(() => {
      done()
      setClosing(false)
    }, EXIT_MS)
  }
  return { closing, close }
}

export function AppShell({ children, title }: { children: ReactNode; title?: string }) {
  const path = usePathname()
  const { locale, setLocale, t } = useLanguage()
  const [theme, setTheme] = useThemeSetting()
  const [mobile, setMobile] = useState(false)
  const [collapsed, setCollapsed] = useState(false)
  const [searchOpen, setSearchOpen] = useState(false)
  const active =
    nav.find(n => n[1] === path)?.[0] ||
    (path.startsWith('/people') ? 'People' : path.startsWith('/vacancies') ? 'Vacancies' : 'Workspace')
  /* ⌘K/Ctrl+K opens search from anywhere, matching every other app this
     audience already uses one in. */
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'k') {
        e.preventDefault()
        setSearchOpen(true)
      }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [])
  return (
    <div className={`app-shell ${collapsed ? 'sidebar-collapsed' : ''}`}>
      <aside className={`sidebar ${mobile ? 'open' : ''} ${collapsed ? 'collapsed' : ''}`}>
        <div className="brand-row">
          <BrandLockup subtitle={t('Dispatcher')} />
          <button
            className="icon-button sidebar-hide"
            onClick={() => {
              setMobile(false)
              setCollapsed(true)
            }}
            aria-label={t('Hide navigation')}
          >
            <PanelLeft />
          </button>
        </div>
        <nav className="main-nav">
          <p className="nav-label">{t('Workspace')}</p>
          {nav.map(([name, href, Icon]) => (
            <Link
              key={href}
              href={href}
              className={`nav-item ${active === name ? 'active' : ''}`}
              onClick={() => setMobile(false)}
            >
              <Icon />
              {t(name)}
            </Link>
          ))}
        </nav>
        <div className="sidebar-bottom">
          <Link className="nav-item" href="/sync">
            <Command />
            {t('Sync sources')}
          </Link>
          <Link className="nav-item" href="/settings/password">
            <KeyRound />
            {t('Change password')}
          </Link>
          <form action={logout}>
            <button className="nav-item" type="submit">
              <LogOut />
              {t('Sign out')}
            </button>
          </form>
          <button className="nav-item" onClick={() => setTheme(theme === 'dark' ? 'light' : 'dark')}>
            {theme === 'dark' ? <Sun /> : <Moon />}
            {t(theme === 'dark' ? 'Light theme' : 'Dark theme')}
          </button>
          <div className="locale-switch" role="group" aria-label={t('Language')}>
            <span>{t('Language')}</span>
            <button
              type="button"
              aria-label={t('Switch language to English')}
              aria-pressed={locale === 'en'}
              className={locale === 'en' ? 'active' : ''}
              onClick={() => setLocale('en')}
            >
              EN
            </button>
            <button
              type="button"
              aria-label={t('Switch language to Dutch')}
              aria-pressed={locale === 'nl'}
              className={locale === 'nl' ? 'active' : ''}
              onClick={() => setLocale('nl')}
            >
              NL
            </button>
          </div>
        </div>
      </aside>
      {mobile && (
        <button
          className="mobile-scrim"
          onClick={() => setMobile(false)}
          aria-label={t('Close navigation')}
        />
      )}
      <main className="main-area">
        <header className="topbar">
          <button
            className="desktop-sidebar-toggle icon-button"
            onClick={() => setCollapsed(false)}
            aria-label={t('Show navigation')}
          >
            <PanelLeft />
          </button>
          <button
            className="mobile-menu icon-button"
            onClick={() => setMobile(true)}
            aria-label={t('Open navigation')}
          >
            <Menu />
          </button>
          <div className="breadcrumbs">
            <span>{t('Workspace')}</span>
            <ChevronRight />
            <strong>{t(title || active)}</strong>
          </div>
          <div className="top-actions">
            <SyncStatusButton />
            <button className="icon-button" aria-label={t('Search')} onClick={() => setSearchOpen(true)}>
              <Search />
            </button>
          </div>
        </header>
        {children}
      </main>
      <SearchDialog open={searchOpen} onClose={() => setSearchOpen(false)} />
    </div>
  )
}
export const dateLabel = (date: string) => formatDate(date)
