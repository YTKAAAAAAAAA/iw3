'use client'
import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { useEffect, useId, useState } from 'react'
import { BriefcaseBusiness, CalendarDays, CheckSquare, ChevronRight, CircleHelp, Clock3, Command, LayoutDashboard, LogOut, Map, Menu, Moon, PanelLeft, Plus, Search, Settings, Sun, Users, X } from 'lucide-react'
import { mockData } from '@/lib/mock-data'
import { formatDate, parseClock, TODAY } from '@/lib/types'
import type { ReactNode } from 'react'
import { Brand } from './logo'

const nav=[['Overview','/',LayoutDashboard],['People','/people',Users],['Vacancies','/vacancies',BriefcaseBusiness],['Hours','/hours',Clock3],['Tasks','/tasks',CheckSquare],['Companies','/companies',Settings],['Map','/map',Map]] as const
export function Avatar({ initials, tone='blue', small=false }:{initials:string;tone?:string;small?:boolean}){return <span className={`avatar avatar-${tone} ${small?'avatar-small':''}`}>{initials}</span>}
export function Badge({children,tone='neutral'}:{children:ReactNode;tone?:string}){return <span className={`badge badge-${tone}`}>{children}</span>}
export function Panel({children,className=''}:{children:ReactNode;className?:string}){return <section className={`panel ${className}`}>{children}</section>}
export function StateBlock({kind='empty',title,description,action}:{kind?:'loading'|'error'|'empty';title:string;description?:string;action?:ReactNode}){return <div className={`state-block ${kind}`}><div className="state-icon">{kind==='loading'?'…':kind==='error'?'!':'—'}</div><strong>{title}</strong>{description&&<p>{description}</p>}{action}</div>}
export function PageHeading({eyebrow,title,description,action}:{eyebrow:string;title:string;description:string;action?:ReactNode}){return <div className="page-heading"><div><p className="eyebrow">{eyebrow}</p><h1>{title}</h1><p className="subheading">{description}</p></div>{action}</div>}
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
const publishTheme = (next: Theme) => { themeValue = next; themeSubscribers.forEach(fn => fn(next)) }

function useThemeSetting() {
  const [theme, setTheme] = useState<Theme>(themeValue)
  /* The colours live on <html>, set by the inline script in the layout before
     the first paint and kept in step here. Keeping them on the shell's own
     div would repaint only after hydration — and would leave the page behind
     the shell in the other theme. */
  useEffect(() => {
    document.documentElement.classList.toggle('theme-dark', theme === 'dark')
    document.documentElement.classList.toggle('theme-light', theme === 'light')
  }, [theme])
  useEffect(() => {
    themeSubscribers.add(setTheme)
    /* Read the stored choice after mounting, never during render: the server
       rendered the default, and adopting a different one mid-render is a
       hydration mismatch. */
    let stored: string | null = null
    try { stored = window.localStorage.getItem(THEME_KEY) } catch { stored = null }
    if ((stored === 'dark' || stored === 'light') && stored !== themeValue) publishTheme(stored)
    else setTheme(themeValue)
    return () => { themeSubscribers.delete(setTheme) }
  }, [])
  const choose = (next: Theme) => {
    try { window.localStorage.setItem(THEME_KEY, next) } catch { /* private window — the choice still holds for this session */ }
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
export function TimeField({value,onChange,label,className=''}:{value:string|null;onChange:(value:string|null)=>void;label:string;className?:string}){
  const [text,setText]=useState(value ?? '')
  useEffect(()=>{setText(value ?? '')},[value])
  const commit=()=>{const parsed=parseClock(text); setText(parsed ?? ''); if(parsed!==value) onChange(parsed)}
  return <input className={`time-field ${className}`} inputMode="numeric" placeholder="--:--" aria-label={label} value={text}
    onChange={e=>setText(e.target.value)} onBlur={commit}
    onKeyDown={e=>{if(e.key==='Enter')(e.target as HTMLInputElement).blur()}} />
}

export function AppShell({children,title}:{children:ReactNode;title?:string}){const path=usePathname(); const [theme,setTheme]=useThemeSetting(); const [mobile,setMobile]=useState(false); const [syncing,setSyncing]=useState(false); const active=nav.find(n=>n[1]===path)?.[0] || (path.startsWith('/people')?'People':path.startsWith('/vacancies')?'Vacancies':'Workspace'); const refresh=()=>{setSyncing(true); window.setTimeout(()=>setSyncing(false),900)}; return <div className="app-shell"><aside className={`sidebar ${mobile?'open':''}`}><div className="brand-row"><Brand /><button className="icon-button sidebar-hide" onClick={()=>setMobile(false)} aria-label="Close navigation"><PanelLeft /></button></div><nav className="main-nav"><p className="nav-label">Workspace</p>{nav.map(([name,href,Icon])=><Link key={href} href={href} className={`nav-item ${active===name?'active':''}`} onClick={()=>setMobile(false)}><Icon />{name}{name==='Tasks'&&<span className="nav-count">{mockData.tasks.filter(t=>!t.done).length}</span>}</Link>)}</nav><div className="sidebar-bottom"><Link className="nav-item" href="/sync"><Command />Sync sources</Link><Link className="nav-item" href="/login"><LogOut />Sign out</Link><button className="nav-item" onClick={()=>setTheme(theme==='dark'?'light':'dark')}>{theme==='dark'?<Sun/>:<Moon/>}{theme==='dark'?'Light theme':'Dark theme'}</button><button className="nav-item"><CircleHelp />Help & support</button><div className="user-mini"><Avatar initials="MV" tone="purple" small/><span><strong>Marit van Dijk</strong><small>Admin workspace</small></span></div></div></aside>{mobile&&<button className="mobile-scrim" onClick={()=>setMobile(false)} aria-label="Close navigation"/>}<main className="main-area"><header className="topbar"><button className="mobile-menu icon-button" onClick={()=>setMobile(true)} aria-label="Open navigation"><Menu/></button><div className="breadcrumbs"><span>Workspace</span><ChevronRight/><strong>{title||active}</strong></div><div className="top-actions"><button className={`sync-button ${syncing?'syncing':''}`} onClick={refresh}>{syncing?'Syncing…':'Synced 28 min ago'}</button><button className="icon-button"><Search/></button><Avatar initials="MJ" tone="purple" small/></div></header>{children}</main></div>}
export const dateLabel=(date:string)=>formatDate(date)
export { TODAY }
