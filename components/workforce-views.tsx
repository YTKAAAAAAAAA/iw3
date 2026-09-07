'use client'
import Link from 'next/link'
import dynamic from 'next/dynamic'
import { useSearchParams } from 'next/navigation'
import { useEffect, useMemo, useRef, useState } from 'react'
import type React from 'react'
import { ArrowUpRight, CalendarDays, Check, ChevronLeft, ChevronRight, CircleAlert, FileText, Filter, MapPin, Plus, Search, Upload, X } from 'lucide-react'
import { AppShell, Avatar, Badge, PageHeading, Panel, StateBlock, TimeField } from './app-shell'
import { Brand } from './logo'
import { companies, hours, leaves, manatalCandidates, mockData, roster, standing, tasks, workers, vacancies } from '@/lib/mock-data'
import { assignmentOn, availableWorkers, currentAssignment, dayStatus, describeSchedule, sortByUrgency, urgencyNote, vacancyStatus, vacancyUrgency } from '@/lib/derive'
import { travelFor } from '@/lib/travel'
import { downloadXlsx } from '@/lib/xlsx'
import { lastNameOf, reportFilename, reportRows, reportSheet } from '@/lib/hours-report'
import { FEATURES } from '@/lib/features'
import { VacancySchedule } from './vacancy-schedule'
import { AddressPicker, type PickedAddress } from './address-picker'
/* Leaflet touches `window` on import and weighs more than the rest of the
   page, so the map is fetched only when asked for. Most of the time the
   kilometres next to each candidate are all anyone needs. */
const LazyMapPanel=dynamic(()=>import('./map-view').then(m=>m.MapPanel),{ssr:false,loading:()=><p className="map-note">Loading map…</p>})
import { addDays, formatDate, taskDateLabel, taskDateTone, TODAY, weekDates, isoWeek } from '@/lib/types'
import type { Company, HoursEntry, Leave, RosterEntry, Task, Vacancy, Worker } from '@/lib/types'

function Metric({label,value,caption,href}:{label:string;value:string|number;caption:string;href:string}){return <Link href={href} className="metric-card"><div className="metric-label">{label}<ArrowUpRight/></div><div className="metric-value-row"><strong>{value}</strong></div><span className="metric-caption">{caption}</span></Link>}
export function Overview(){const active=workers.filter(w=>w.status==='active'); const free=availableWorkers(workers,TODAY,roster,leaves,vacancies); const open=vacancies.filter(v=>vacancyStatus(v,standing,roster,TODAY)==='open'); const leave=workers.filter(w=>dayStatus(w.id,TODAY,roster,leaves,vacancies)==='leave'); return <AppShell><div className="content-inner"><PageHeading eyebrow="Tuesday, 18 June 2024" title="Good morning, Marit" description="Here’s what’s happening across your workforce today." action={<Link className="button button-primary" href="/vacancies/new"><Plus/>Create vacancy</Link>}/><section className="metrics-grid"><Metric label="Open vacancies" value={open.length} caption={`${vacancies.length} total vacancies`} href="/vacancies"/><Metric label="People available" value={free.length} caption={`of ${active.length} active people`} href="/people"/><Metric label="On leave today" value={leave.length} caption="Leave takes priority over work" href="/people"/><Metric label="Total people" value={active.length} caption={`${workers.length-active.length} dismissed workers`} href="/people?status=dismissed"/></section><div className="dashboard-grid"><Panel><div className="panel-header"><div><h2>Today’s availability</h2><p>People ready for assignment</p></div><Link className="text-button" href="/people">View people <ArrowUpRight/></Link></div>{free.slice(0,5).map((w,i)=><Link className="availability-row" href={`/people/${w.id}`} key={w.id}><Avatar initials={w.initials} tone={['blue','green','teal','purple','orange'][i%5]} small/><div><strong>{w.fullName}</strong><span>{w.city} · Available today</span></div><Badge tone="green">Free</Badge></Link>)}</Panel><Panel><div className="panel-header"><div><h2>Coming up</h2><p>Leave and roster overview</p></div><CalendarDays/></div>{leaves.slice(0,4).map(l=>{const w=workers.find(x=>x.id===l.workerId)!;return <Link className="coming-item" href={`/people/${w.id}`} key={l.id}><div className="date-block"><strong>{l.date.slice(-2)}</strong><span>{formatDate(l.date).split(' ')[1]}</span></div><div><strong>{w.fullName}</strong><span>{l.reason} · {formatDate(l.date)}</span></div><Avatar initials={w.initials} tone="orange" small/></Link>})}</Panel></div><Panel className="people-preview"><div className="panel-header"><div><h2>People</h2><p>Recently active and available workers</p></div><Link className="text-button" href="/people">View all people <ArrowUpRight/></Link></div><PeopleTable compact/></Panel></div></AppShell>}
function PeopleTable({compact=false}:{compact?:boolean}){const [query,setQuery]=useState('');const [availability,setAvailability]=useState('All availability');const [company,setCompany]=useState('All companies');const [date,setDate]=useState(TODAY);const [page,setPage]=useState(1);const active=workers.filter(w=>w.status==='active');const filtered=active.filter(w=>w.fullName.toLowerCase().includes(query.toLowerCase())&&(availability==='All availability'||(availability==='Available'&&dayStatus(w.id,date,roster,leaves,vacancies)==='free')||(availability==='Working'&&dayStatus(w.id,date,roster,leaves,vacancies)==='working')||(availability==='Leave'&&dayStatus(w.id,date,roster,leaves,vacancies)==='leave'))&&(company==='All companies'||w.companyAccess.includes(company)));return <div className="table-wrap">{!compact&&<div className="table-toolbar"><div className="search-field"><Search/><input value={query} onChange={e=>setQuery(e.target.value)} placeholder="Search people" aria-label="Search people"/></div><select value={company} onChange={e=>setCompany(e.target.value)} aria-label="Company filter"><option>All companies</option>{companies.map(c=><option key={c.id} value={c.id}>{c.name}</option>)}</select><select value={availability} onChange={e=>setAvailability(e.target.value)} aria-label="Availability filter"><option>All availability</option><option>Available</option><option>Working</option><option>Leave</option></select><label className="date-filter"><CalendarDays/><input type="date" value={date} onChange={e=>setDate(e.target.value)} aria-label="Availability date"/></label><button className="button button-secondary"><Filter/>More filters</button><span className="result-count">Showing {Math.min((page-1)*25+1,filtered.length)}–{Math.min(page*25,filtered.length)} of {filtered.length} people</span></div>}<table><thead><tr><th>Person</th>{!FEATURES.leanPeopleList&&<th>Phone</th>}<th>Company access</th><th>Availability · {formatDate(date)}</th><th/></tr></thead><tbody>{filtered.slice(0,compact?5:25).slice((page-1)*25).map(w=>{const state=dayStatus(w.id,date,roster,leaves,vacancies);return <tr key={w.id}><td><Link className="person-cell" href={`/people/${w.id}`}><Avatar initials={w.initials} tone="blue" small/><span><strong>{w.fullName}</strong><small>{FEATURES.leanPeopleList?w.city:`${w.city} · ${w.email}`}</small></span></Link></td>{!FEATURES.leanPeopleList&&<td>{w.mobile}</td>}<td><div className="access-list">{w.companyAccess.slice(0,3).map(id=><span key={id}>{companies.find(c=>c.id===id)?.name}</span>)}</div></td><td><Badge tone={state==='free'?'green':state==='leave'?'orange':'blue'}>{state==='free'?'Available':state==='leave'?'Leave':'Working'}</Badge><small className="table-detail">{state==='working'?(currentAssignment(w.id,date,roster,vacancies)?.title||'Rostered shift'):state==='leave'?'On leave':'Ready for assignment'}</small></td><td><Link className="icon-button" href={`/people/${w.id}`} aria-label={`Open ${w.fullName}`}><ArrowUpRight/></Link></td></tr>})}</tbody></table>{!filtered.length&&<StateBlock title="No people match these filters" description="Try changing the date, access company, or availability."/>}</div>}
export function PeopleView(){const dismissed=useSearchParams().get('status')==='dismissed';return <AppShell><div className="content-inner"><PageHeading eyebrow="Workforce directory" title={dismissed?'Dismissed people':'People'} description={dismissed?'Historical records remain available for reports and hours.':'Manage availability, company access and assignments.'} action={<Link className="button button-secondary" href={dismissed?'/people':'/people?status=dismissed'}>{dismissed?'Active people':'View dismissed'}</Link>}/><Panel className="full-panel">{dismissed?<DismissedList/>:<PeopleTable/>}</Panel></div></AppShell>}
function DismissedList(){const list=workers.filter(w=>w.status==='dismissed');return <div className="table-wrap"><table><thead><tr><th>Person</th><th>Dismissed on</th><th>History</th><th/></tr></thead><tbody>{list.map(w=><tr key={w.id}><td><Link className="person-cell" href={`/people/${w.id}`}><Avatar initials={w.initials} tone="purple" small/><span><strong>{w.fullName}</strong><small>{w.email}</small></span></Link></td><td>{formatDate(w.dismissedAt)}</td><td>{hours.filter(h=>h.workerId===w.id).length} saved hours</td><td><Badge tone="neutral">Dismissed</Badge></td></tr>)}</tbody></table></div>}
/* ------------------------------------------------------------------
   The worker's month.

   Days are picked, not opened: a holiday is two weeks, not one day, and
   clicking through fourteen dialogs to enter it is how people stop entering
   it at all. Tapping a day adds it to the selection, tapping it again takes
   it out, and shift-clicking fills the span between — then one action covers
   everything picked. The same selection is what removes leave again.
   ------------------------------------------------------------------ */
function Calendar({ workerId }: { workerId: string }) {
  const [view, setView] = useState({ y: Number(TODAY.slice(0, 4)), m: Number(TODAY.slice(5, 7)) - 1 })
  const [picked, setPicked] = useState<string[]>([TODAY])
  /* The anchor is the last day touched, which is what shift-click measures from. */
  const [anchor, setAnchor] = useState<string>(TODAY)
  const [entries, setEntries] = useState<Leave[]>(leaves)
  const [reason, setReason] = useState('')
  const [paid, setPaid] = useState(true)

  const shiftMonth = (delta: number) => setView(cur => {
    const d = new Date(Date.UTC(cur.y, cur.m + delta, 1))
    return { y: d.getUTCFullYear(), m: d.getUTCMonth() }
  })

  const first = new Date(Date.UTC(view.y, view.m, 1))
  const start = (first.getUTCDay() + 6) % 7
  const days = Array.from({ length: 42 }, (_, i) => {
    const d = new Date(Date.UTC(view.y, view.m, 1 - start + i))
    return d.toISOString().slice(0, 10)
  })

  const span = (from: string, to: string) => {
    const [a, b] = from <= to ? [from, to] : [to, from]
    const out: string[] = []
    for (let d = a; d <= b; d = addDays(d, 1)) out.push(d)
    return out
  }
  const choose = (date: string, extend: boolean) => {
    setPicked(cur => extend
      ? [...new Set([...cur, ...span(anchor, date)])]
      : cur.includes(date) ? cur.filter(d => d !== date) : [...cur, date])
    setAnchor(date)
  }

  const leaveOn = (date: string) => entries.find(l => l.workerId === workerId && l.date === date)
  const dayState = (date: string) => leaveOn(date) ? 'leave' : assignmentOn(workerId, date, null, roster, vacancies) ? 'working' : 'free'

  const chosen = [...picked].sort()
  /* Three reasons a picked day cannot take a day off, each worth naming: it
     has already gone, somebody is expecting this person on a job, or it is
     already a day off. */
  const pastDays = chosen.filter(d => d < TODAY)
  const assigned = chosen.filter(d => d >= TODAY && !leaveOn(d) && assignmentOn(workerId, d, null, roster, vacancies))
  const markable = chosen.filter(d => d >= TODAY && dayState(d) === 'free')
  const removable = chosen.filter(d => d >= TODAY && leaveOn(d))

  const markOff = () => {
    setEntries(cur => [...cur, ...markable.map(date => ({
      id: `l-${workerId}-${date}`, workerId, date, reason: reason.trim() || 'Day off', paidLeave: paid,
    }))])
    setPicked([]); setReason('')
  }
  const removeOff = () => {
    setEntries(cur => cur.filter(l => !(l.workerId === workerId && removable.includes(l.date))))
    setPicked([])
  }

  const single = chosen.length === 1 ? chosen[0] : null
  const info = single ? assignmentOn(workerId, single, null, roster, vacancies) : null
  const monthKey = `${view.y}-${String(view.m + 1).padStart(2, '0')}`

  return (
    <div className="calendar-area">
      <div className="calendar-head">
        <button className="icon-button" onClick={() => shiftMonth(-1)} aria-label="Previous month"><ChevronLeft /></button>
        <strong>{new Intl.DateTimeFormat('en-GB', { month: 'long', year: 'numeric' }).format(first)}</strong>
        <button className="icon-button" onClick={() => shiftMonth(1)} aria-label="Next month"><ChevronRight /></button>
      </div>
      <div className="calendar-weekdays">{['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'].map(d => <span key={d}>{d}</span>)}</div>
      <div className="calendar-grid">
        {days.map(date => {
          const state = dayState(date)
          return (
            <button key={date} onClick={e => choose(date, e.shiftKey)} aria-pressed={picked.includes(date)}
              className={`calendar-day ${date.slice(0, 7) !== monthKey ? 'muted' : ''} ${date === TODAY ? 'today' : ''} ${picked.includes(date) ? 'picked' : ''} ${state}`}>
              <span>{Number(date.slice(-2))}</span>{state !== 'free' && <i />}
            </button>
          )
        })}
      </div>
      <div className="legend">
        <span><i className="working" />Working</span>
        <span><i className="leave" />Leave</span>
        <span><i className="free" />Free</span>
        <span className="legend-hint">Click to pick · shift-click for a span</span>
      </div>

      <Panel className="selected-day">
        <div className="panel-header">
          <div>
            <h2>{single ? formatDate(single) : `${chosen.length} days selected`}</h2>
            <p>{single
              ? (single === TODAY ? 'Today' : single < TODAY ? 'Past day' : 'Future day')
              : chosen.length ? `${formatDate(chosen[0])} – ${formatDate(chosen[chosen.length - 1])}` : 'Nothing picked yet'}</p>
          </div>
          {single && <Badge tone={leaveOn(single) ? 'orange' : info ? 'blue' : 'neutral'}>{leaveOn(single) ? 'Leave' : info ? 'Working' : 'Free'}</Badge>}
          {!single && chosen.length > 0 && <button className="button button-secondary button-small" onClick={() => setPicked([])}>Clear</button>}
        </div>

        {!chosen.length && <p className="muted-copy">Pick one or more days in the calendar above.</p>}

        {removable.length > 0 && (
          <div className="day-action">
            <strong>{removable.length === 1 ? leaveOn(removable[0])!.reason : `${removable.length} days off`}</strong>
            <span>{removable.length === 1 ? (leaveOn(removable[0])!.paidLeave ? 'Paid leave' : 'Unpaid leave') : 'Selected days that are marked off'}</span>
            <button className="button button-secondary" onClick={removeOff}>
              {removable.length === 1 ? 'Remove day off' : `Remove ${removable.length} days off`}
            </button>
          </div>
        )}

        {markable.length > 0 && (
          <div className="day-action">
            <input placeholder="Reason" aria-label="Day off reason" value={reason} onChange={e => setReason(e.target.value)} />
            <label><input type="checkbox" checked={paid} onChange={e => setPaid(e.target.checked)} /> Paid leave</label>
            <button className="button button-primary" onClick={markOff}>
              {markable.length === 1 ? 'Mark as day off' : `Mark ${markable.length} days off`}
            </button>
          </div>
        )}

        {assigned.length > 0 && (
          <p className="muted-copy">{assigned.length === 1
            ? `${formatDate(assigned[0])} is assigned — remove the assignment before marking it off.`
            : `${assigned.length} of the selected days are assigned and were left alone — remove those assignments first.`}</p>
        )}
        {pastDays.length > 0 && (
          <p className="muted-copy">{pastDays.length === 1 ? 'One selected day' : `${pastDays.length} selected days`} already passed and can only be viewed.</p>
        )}
      </Panel>
    </div>
  )
}
export function PersonView({id}:{id:string}){const w=workers.find(x=>x.id===id)||workers[0];const [notes,setNotes]=useState(w.notes);const [access,setAccess]=useState(w.companyAccess)
/* Own transport is a switch, not a printed fact: cars are sold and bought,
   and a stale "no car" quietly keeps somebody out of every car-only site. */
const [hasCar,setHasCar]=useState(w.hasCar);return <AppShell title="Person"><div className="content-inner"><div className="back-link"><Link href="/people">← Back to people</Link></div>{w.status==='dismissed'&&<div className="dismissed-banner"><CircleAlert/><span>Dismissed on {formatDate(w.dismissedAt)}. This record is read-only except internal notes.</span></div>}<PageHeading eyebrow="Worker profile" title={w.fullName} description={`${w.city} · ${w.email}`} action={<Badge tone={w.status==='active'?'green':'neutral'}>{w.status}</Badge>}/><div className="profile-grid"><div className="profile-left"><Panel><div className="profile-hero"><Avatar initials={w.initials} tone="blue"/><div><h2>{w.fullName}</h2><p>{w.initials} · {w.nationality}</p></div></div><div className="detail-grid">{[['First name',w.firstName],['Insertion',w.insertion],['Last name',w.lastName],['Gender',w.gender],['Birth date',formatDate(w.birthDate)],['Address',[w.street,w.streetNumber,w.streetNumberAddition].filter(Boolean).join(' ')],['Postcode / city',[w.postCode,w.city].filter(Boolean).join(' · ')],['Residence country',w.residenceCountry],['Nationality',w.nationality],['Own transport',<div className="seg seg-small" key="car">{([[true,'Car'],[false,'No car']] as const).map(([value,label])=><button type="button" key={label} className={hasCar===value?'active':''} disabled={w.status==='dismissed'} onClick={()=>setHasCar(value)}>{label}</button>)}</div>],['Phone',w.phone],['Mobile',w.mobile],['Email',w.email]].map(([label,value])=><div key={label as string}><span>{label}</span>{typeof value==='string'||value===null||value===undefined?<strong>{value||'—'}</strong>:value}</div>)}</div>{w.lat===null&&<div className="inline-note"><MapPin/>Coordinates are not defined. This person is excluded from distance matching.</div>}<div className="section-divider"/><div className="panel-header"><div><h2>Manatal CV</h2><p>Linked resume remains in Manatal; no copy is stored here.</p></div></div>{w.manatalLink==='linked'?<a className="button button-secondary" href={w.cvUrl||'#'} target="_blank" rel="noreferrer">Open CV in Manatal <ArrowUpRight/></a>:w.manatalLink==='not_found'?<div className="match-row"><Badge tone="orange">Not found in Manatal</Badge><button className="button button-secondary">Link manually</button></div>:<div className="match-row"><Badge tone="orange">Several candidates match this email</Badge><select aria-label="Select Manatal candidate">{manatalCandidates.map(c=><option key={c.id}>{c.name} · {c.email}</option>)}</select><button className="button button-secondary">Link candidate</button></div>}</Panel><Panel><div className="panel-header"><div><h2>Internal notes</h2><p>Only this field is editable in the worker profile.</p></div></div><textarea value={notes} onChange={e=>setNotes(e.target.value)} disabled={w.status==='dismissed'} aria-label="Internal notes"/><div className="form-footer"><button className="button button-primary" disabled={w.status==='dismissed'}>Save notes</button></div></Panel><Panel><div className="panel-header"><div><h2>Company access</h2><p>Access permits work at company sites; it is not an assignment.</p></div></div>{companies.map(c=><label className="access-toggle" key={c.id}><span><strong>{c.name}</strong><small>{c.contactPerson}</small></span><input type="checkbox" checked={access.includes(c.id)} onChange={()=>setAccess(v=>v.includes(c.id)?v.filter(x=>x!==c.id):[...v,c.id])} disabled={w.status==='dismissed'}/></label>)}</Panel></div><div className="profile-right"><Panel><Calendar workerId={w.id}/></Panel></div></div></div></AppShell>}
export function VacanciesView(){const [tab,setTab]=useState<'open'|'in_progress'|'archived'>('open')
/* Worst first: a job that has already started with nobody on it outranks one
   starting on Friday, and both outrank the quiet ones. Inside each group the
   nearest date comes first — for the late ones that is the longest wait. */
const list=sortByUrgency(vacancies.filter(v=>vacancyStatus(v,standing,roster,TODAY)===tab),standing,roster,TODAY);return <AppShell><div className="content-inner"><PageHeading eyebrow="Assignments" title="Vacancies" description="Client orders and the people assigned to them." action={<Link className="button button-primary" href="/vacancies/new"><Plus/>Create vacancy</Link>}/><div className="tabs">{(['open','in_progress','archived'] as const).map(t=><button key={t} onClick={()=>setTab(t)} className={tab===t?'active':''}>{t==='in_progress'?'In progress':t[0].toUpperCase()+t.slice(1)} <span>{vacancies.filter(v=>vacancyStatus(v,standing,roster,TODAY)===t).length}</span></button>)}</div><Panel className="full-panel">{list.length?list.map(v=>{const urgency=vacancyUrgency(v,standing,roster,TODAY)
const note=urgencyNote(v,urgency,TODAY)
return <Link className={`vacancy-row urgency-${urgency}`} href={`/vacancies/${v.id}`} key={v.id}><div className="vacancy-icon"><BriefcaseIcon/></div><div><strong>{v.title}</strong><span>{companies.find(c=>c.id===v.companyId)?.name} · {v.address}</span></div><Badge tone={urgency==='late'?'urgent':urgency==='soon'?'orange':tab==='open'?'green':tab==='archived'?'neutral':'blue'}>{note?(urgency==='late'?'Unstaffed':'Starts soon'):tab==='in_progress'?'In progress':tab[0].toUpperCase()+tab.slice(1)}</Badge><small>{note??`${v.places.length?`${v.places.length} places`:'single site'} · ${v.trackHoursManually?'Hours tracked manually':'No manual hours'}`}</small><ArrowUpRight/></Link>}):<StateBlock title="No vacancies in this view" description="Create a vacancy to start assigning people." action={<Link href="/vacancies/new" className="button button-primary"><Plus/>Create vacancy</Link>}/>}</Panel></div></AppShell>}
function BriefcaseIcon(){return <span className="vacancy-icon-mark">▰</span>}
export function VacancyView({id}:{id:string}){const v=vacancies.find(x=>x.id===id)||vacancies[0]
const [showMap,setShowMap]=useState(false)
const status=vacancyStatus(v,standing,roster,TODAY)
return <AppShell title="Vacancy"><div className="content-inner"><div className="back-link"><Link href="/vacancies">← Back to vacancies</Link></div><PageHeading eyebrow="Vacancy detail" title={v.title} description={`${companies.find(c=>c.id===v.companyId)?.name} · ${v.address}`} action={<Badge tone={status==='archived'?'neutral':status==='open'?'orange':'green'}>{status.replace('_',' ')}</Badge>}/><div className="vacancy-meta"><span><MapPin/>{v.address}</span><span><CalendarDays/>{formatDate(v.startDate)} – {v.endDate?formatDate(v.endDate):'Open-ended'}</span><span>{v.trackHoursManually?'Hours tracked manually':'Hours not tracked manually'}</span></div>

{FEATURES.schedulePattern&&<Panel className="full-panel"><div className="panel-header"><div><h2>Schedule</h2><p>How this object is normally staffed.</p></div></div><ul className="schedule-lines">{describeSchedule(v).map(line=><li key={line}>{line}</li>)}</ul></Panel>}

{/* People and days live in one place. There is no separate "assign person"
    any more: a schedule already says who works when, and a replacement is
    the same edit at a different size. */}
<Panel className="full-panel"><VacancySchedule vacancy={v}/></Panel>

<Panel className="full-panel vacancy-map"><div className="panel-header"><div><h2>Who is nearby</h2><p>Road distance from {v.address}. Kilometres show on every candidate when picking people; the map is for choosing by eye.</p></div><button className="button button-secondary" onClick={()=>setShowMap(x=>!x)}>{showMap?'Hide map':'Show on map'}</button></div>{showMap&&<div style={{padding:'0 18px 18px'}}><LazyMapPanel vacancyId={v.id}/></div>}</Panel>
</div></AppShell>}

export function VacancyForm(){const [open,setOpen]=useState(false);const [address,setAddress]=useState<PickedAddress|null>(null)
/* How much of the clock this job keeps. Some clients order a window, some
   only say when to be there, and some order people with no times at all —
   the form asks once and the schedule follows. */
const [timing,setTiming]=useState<'window'|'start'|'none'>('window')
const [start,setStart]=useState<string|null>('08:00')
const [end,setEnd]=useState<string|null>('16:30')
const [manualHours,setManualHours]=useState(false)
const [defaultHours,setDefaultHours]=useState('8')
const [projectCode,setProjectCode]=useState('')
return <AppShell title="Create vacancy"><div className="content-inner"><div className="back-link"><Link href="/vacancies">← Back to vacancies</Link></div><PageHeading eyebrow="Assignments" title="Create vacancy" description="Add a client order without storing computed status."/><Panel className="form-panel"><div className="field-grid"><label>Title<input placeholder="e.g. Inbound warehouse team"/></label><label>Company<select>{companies.map(c=><option key={c.id}>{c.name}</option>)}</select></label><div className="wide"><label>Site address</label><AddressPicker value={address} onChange={setAddress}/></div><label className="wide">Description<textarea placeholder="What will the team do?"/></label><label>Start date<input type="date" defaultValue={TODAY}/></label><label>End date<input type="date" disabled={open}/></label><label className="checkbox-field"><input type="checkbox" checked={open} onChange={e=>setOpen(e.target.checked)}/> Open-ended vacancy</label><div className="wide"><label>Times</label><div className="seg">{([['window','Start and end'],['start','Start only'],['none','No times']] as const).map(([value,label])=><button type="button" key={value} className={timing===value?'active':''} onClick={()=>setTiming(value)}>{label}</button>)}</div><p className="field-hint">{timing==='window'?'A normal window — 07:00–16:00. Overtime extends the end.':timing==='start'?'People are told when to be there and go home when the work is done. The rest of that day stays blocked for them.':'Nothing is written down but who was there. Use this where times are pointless or the client keeps them.'}</p></div>{timing!=='none'&&<label>Usual start<TimeField value={start} label="Usual start" onChange={v=>setStart(v)}/></label>}{timing==='window'&&<label>Usual end<TimeField value={end} label="Usual end" onChange={v=>setEnd(v)}/></label>}<label className="checkbox-field"><input type="checkbox" checked={manualHours} onChange={e=>setManualHours(e.target.checked)}/> Track hours manually</label>{manualHours&&<><label>Default hours per day<input type="number" min={0} max={24} step={0.25} value={defaultHours} onChange={e=>setDefaultHours(e.target.value)} placeholder="8"/><small className="field-hint">Everyone on the schedule that day starts with this. Clearing a cell puts it back — only the days that went differently get typed.</small></label><label>Project code<input value={projectCode} onChange={e=>setProjectCode(e.target.value)} placeholder="ALWct"/><small className="field-hint">The client's own code, printed in their weekly sheet.</small></label></>}<label className="checkbox-field"><input type="checkbox"/> Reachable by car only — people without one cannot be placed here</label></div><div className="form-footer"><Link href="/vacancies" className="button button-secondary">Cancel</Link><button className="button button-primary">Create vacancy</button></div></Panel></div></AppShell>}
export function CompaniesView(){const [list,setList]=useState<Company[]>(companies)
const [editing,setEditing]=useState<Company|'new'|null>(null)
const [error,setError]=useState('')
const [draft,setDraft]=useState({name:'',contactPerson:'',phone:'',notes:''})
const open=(c:Company|'new')=>{setError('')
setEditing(c)
setDraft(c==='new'?{name:'',contactPerson:'',phone:'',notes:''}:{name:c.name,contactPerson:c.contactPerson??'',phone:c.phone??'',notes:c.notes??''})}
const save=()=>{const name=draft.name.trim()
if(!name){setError('A company needs a name.');return}
const clash=list.some(c=>c.name.trim().toLowerCase()===name.toLowerCase()&&(editing==='new'||c.id!==editing?.id))
if(clash){setError(`A company called "${name}" already exists.`);return}
setList(cur=>editing==='new'?[...cur,{id:`c-${Date.now()}`,name,contactPerson:draft.contactPerson||null,phone:draft.phone||null,notes:draft.notes||null,logoUrl:null}]:cur.map(c=>c.id===(editing as Company).id?{...c,name,contactPerson:draft.contactPerson||null,phone:draft.phone||null,notes:draft.notes||null}:c))
setEditing(null)}
return <AppShell><div className="content-inner"><PageHeading eyebrow="Workspace directory" title="Companies" description="Client contacts and access coverage." action={<button className="button button-primary" onClick={()=>open('new')}><Plus/>Add company</button>}/><Panel className="full-panel"><div className="company-grid">{list.map(c=><div className="company-card" key={c.id}><div className="company-logo">{c.logoUrl?<img src={c.logoUrl} alt=""/>:c.name[0]}</div><div><h2>{c.name}</h2><p>{c.contactPerson} · {c.phone}</p><strong>{workers.filter(w=>w.status==='active'&&w.companyAccess.includes(c.id)).length} people with access</strong></div><button className="icon-button" aria-label={`Edit ${c.name}`} onClick={()=>open(c)}><ArrowUpRight/></button></div>)}</div></Panel>{editing&&<div className="dialog-backdrop" onClick={()=>setEditing(null)}><div className="dialog" onClick={e=>e.stopPropagation()}><div className="panel-header"><h2>{editing==='new'?'Add company':'Edit company'}</h2><button className="icon-button" onClick={()=>setEditing(null)} aria-label="Close"><X/></button></div><label>Company name<input placeholder="Company name" value={draft.name} onChange={e=>setDraft({...draft,name:e.target.value})}/></label><label>Contact person<input placeholder="Name" value={draft.contactPerson} onChange={e=>setDraft({...draft,contactPerson:e.target.value})}/></label><label>Phone<input placeholder="+31" value={draft.phone} onChange={e=>setDraft({...draft,phone:e.target.value})}/></label><label>Notes<textarea value={draft.notes} onChange={e=>setDraft({...draft,notes:e.target.value})}/></label><label className="upload-field"><Upload/>Upload logo<input type="file" accept="image/*"/></label>{error&&<p className="dialog-note" role="alert">{error}</p>}<div className="form-footer"><button className="button button-secondary" onClick={()=>setEditing(null)}>Cancel</button><button className="button button-primary" onClick={save}>Save company</button></div></div></div>}</div></AppShell>}

export function HoursView(){const trackableVacancies=vacancies.filter(x=>x.trackHoursManually&&vacancyStatus(x,standing,roster,TODAY)!=='archived')
const [date,setDate]=useState(TODAY)
const [vacancyId,setVacancyId]=useState(trackableVacancies[0]?.id??vacancies[0].id)
/* Entries are keyed by person AND vacancy AND day. The previous version kept
   one value per person, so hours typed on Monday reappeared on Tuesday. */
const [entries,setEntries]=useState<HoursEntry[]>(hours)
const [report,setReport]=useState(false)
const v=vacancies.find(x=>x.id===vacancyId)!
const inPeriod=date>=v.startDate&&(!v.endDate||date<=v.endDate)
/* Admission to a company is not an assignment to one of its vacancies —
   the timesheet lists whoever is actually on this job that day. */
const people=workers.filter(w=>w.status==='active'&&assignmentOn(w.id,date,null,roster,vacancies)?.vacancyId===v.id)
const typedFor=(workerId:string)=>entries.find(e=>e.workerId===workerId&&e.vacancyId===v.id&&e.date===date)?.hours
/* A normal day is the same number for everybody on it, so that number is the
   starting point and the office only touches the days that went differently.
   Clearing a cell drops back to the default rather than to nothing — a blank
   would have to mean "not worked", and that is what typing 0 is for. */
const valueFor=(workerId:string)=>typedFor(workerId)??v.defaultHours??undefined
const setValue=(workerId:string,raw:string)=>{const hoursValue=Number(raw)
setEntries(cur=>{const rest=cur.filter(e=>!(e.workerId===workerId&&e.vacancyId===v.id&&e.date===date))
if(raw===''||Number.isNaN(hoursValue))return rest
return [...rest,{id:`h-${workerId}-${v.id}-${date}`,workerId,vacancyId:v.id,date,hours:hoursValue}]})}
return <AppShell><div className="content-inner"><PageHeading eyebrow="Time tracking" title="Hours" description="Enter manual hours for active, non-archived vacancies." action={<button className="button button-secondary" onClick={()=>setReport(true)}><FileText/>Weekly report</button>}/><Panel className="hours-panel"><div className="table-toolbar"><label>Date<input type="date" value={date} onChange={e=>setDate(e.target.value)}/></label><label>Vacancy<select value={vacancyId} onChange={e=>setVacancyId(e.target.value)}>{trackableVacancies.map(x=><option key={x.id} value={x.id}>{x.title}</option>)}</select></label>{!inPeriod&&<Badge tone="orange">Date outside vacancy period</Badge>}</div><div className="table-wrap"><table><thead><tr><th>Person</th><th>Availability</th><th>Hours</th></tr></thead><tbody>{people.map(w=>{const state=dayStatus(w.id,date,roster,leaves,vacancies)
return <tr key={w.id}><td><Link className="person-cell" href={`/people/${w.id}`}><Avatar initials={w.initials} tone="blue" small/><span><strong>{w.fullName}</strong><small>{w.city}</small></span></Link></td><td>{state==='leave'?<Badge tone="orange">On leave</Badge>:state==='working'?<Badge tone="blue">Working</Badge>:<Badge tone="neutral">Free</Badge>}</td><td><input className="hours-input" type="number" min="0" max="24" step="0.5" value={valueFor(w.id)??''} onChange={e=>setValue(w.id,e.target.value)} placeholder="0.0" aria-label={`Hours for ${w.fullName}`}/></td></tr>})}</tbody></table>{!people.length&&<StateBlock title="Nobody is on this vacancy on this day" description="Assign people to the vacancy first, or pick another date."/>}</div><div className="form-footer"><span>{v.defaultHours!==null?`${people.filter(w=>typedFor(w.id)!==undefined).length} of ${people.length} typed by hand · the rest count as ${v.defaultHours} h`:`${people.filter(w=>typedFor(w.id)!==undefined).length} of ${people.length} rows filled`}</span><button className="button button-primary">Save hours</button></div></Panel></div>{report&&<ReportDialog vacancy={v} entries={entries} onClose={()=>setReport(false)}/>}</AppShell>}

function ReportDialog({vacancy,entries,onClose}:{vacancy:Vacancy;entries:HoursEntry[];onClose:()=>void}){const current=isoWeek(TODAY)
const [week,setWeek]=useState(current.week)
const [year,setYear]=useState(current.year)
const days=weekDates(year,week)
/* One source for the sheet and for the preview below, so what is on screen is
   what the client receives — including days nobody typed, which count as the
   vacancy's default when the person was on the schedule. */
const input={vacancy,company:companies.find(c=>c.id===vacancy.companyId),workers,entries,roster,year,week}
const rows=reportRows(input)
const download=()=>downloadXlsx(reportSheet(input),reportFilename(input))
return <div className="dialog-backdrop" onClick={onClose}><div className="dialog dialog-wide" onClick={e=>e.stopPropagation()}><div className="panel-header"><div><h2>Weekly report</h2><p>{input.company?.name} · {vacancy.title}</p></div><button className="icon-button" onClick={onClose} aria-label="Close"><X/></button></div><div className="dialog-row"><label>ISO week<input type="number" min={1} max={53} value={week} onChange={e=>setWeek(Math.min(53,Math.max(1,Number(e.target.value)||1)))}/></label><label>Year<input type="number" value={year} onChange={e=>setYear(Number(e.target.value)||current.year)}/></label></div><p className="dialog-note">Week {week} runs {formatDate(days[0])} – {formatDate(days[6])}. The sheet goes out in the client's own layout — their name across the top, our contact lines, one row per person and the signature block at the foot.{vacancy.defaultHours!==null&&` Days nobody typed count as ${vacancy.defaultHours} h for whoever was on the schedule.`}</p>{rows.length?<div className="table-wrap"><table className="report-table"><thead><tr><th>F-Name</th><th>L-Name</th><th>Projectcode</th>{days.map(d=><th key={d}>{formatDate(d)}</th>)}<th>Total</th></tr></thead><tbody>{rows.map(r=><tr key={r.worker.id}><td>{r.worker.firstName}</td><td>{lastNameOf(r.worker)}</td><td>{vacancy.projectCode??'—'}</td>{r.cells.map((c,i)=><td key={i}>{c||'—'}</td>)}<td><strong>{r.total}</strong></td></tr>)}</tbody><tfoot><tr><td colSpan={3}>{rows.length} {rows.length===1?'person':'people'}</td>{days.map((d,i)=><td key={d}><strong>{rows.reduce((sum,r)=>sum+r.cells[i],0)||'—'}</strong></td>)}<td><strong>{rows.reduce((sum,r)=>sum+r.total,0)}</strong></td></tr></tfoot></table></div>:<StateBlock title="Nothing to report for this week" description="Nobody was on the schedule and no hours were typed. Pick another week."/>}<div className="form-footer"><button className="button button-secondary" onClick={onClose}>Close</button><button className="button button-primary" disabled={!rows.length} onClick={download}><FileText/>Download Excel</button></div></div></div>}

export function TasksView(){const [items,setItems]=useState(tasks)
const [drag,setDrag]=useState<string|null>(null)
const [over,setOver]=useState<{column:string;index:number}|null>(null)
const dragRef=useRef<{id:string;moved:boolean;x:number;y:number}|null>(null)
const move=(taskId:string,columnId:string,index:number)=>setItems(old=>{const moving=old.find(t=>t.id===taskId)
if(!moving)return old
const others=old.filter(t=>t.id!==taskId)
const target=others.filter(t=>t.columnId===columnId).sort((a,b)=>a.position-b.position)
target.splice(Math.max(0,Math.min(index,target.length)),0,{...moving,columnId})
const renumbered=new Map(target.map((t,i)=>[t.id,i]))
return others.filter(t=>t.columnId!==columnId).concat(target.map(t=>({...t,columnId,position:renumbered.get(t.id)!})))})
/* Dragging is tracked on the window, not on the columns.
   Touch pointers get implicit pointer capture from the browser, so events
   during a touch drag are delivered to the card that was pressed and never
   to the column underneath it. The previous version also called
   setPointerCapture explicitly, which broke the mouse case the same way:
   the drop target never saw pointerenter/pointerup, while pointerup still
   bubbled to the SOURCE column — so a card dragged anywhere simply jumped
   to the bottom of its own column. Hit-testing with elementFromPoint works
   for both input kinds. */
useEffect(()=>{if(!drag)return
const onMove=(e:PointerEvent)=>{const d=dragRef.current
if(!d)return
if(!d.moved&&Math.hypot(e.clientX-d.x,e.clientY-d.y)<4)return
d.moved=true
const under=document.elementFromPoint(e.clientX,e.clientY) as HTMLElement|null
const column=under?.closest('[data-column-id]') as HTMLElement|null
if(!column){setOver(null);return}
const cards=Array.from(column.querySelectorAll<HTMLElement>('[data-task-id]'))
const index=cards.filter(card=>{if(card.dataset.taskId===d.id)return false
const box=card.getBoundingClientRect()
return e.clientY>box.top+box.height/2}).length
setOver({column:column.dataset.columnId!,index})}
const onUp=()=>{const d=dragRef.current
if(d&&d.moved&&over)move(d.id,over.column,over.index)
dragRef.current=null
setDrag(null)
setOver(null)}
window.addEventListener('pointermove',onMove)
window.addEventListener('pointerup',onUp)
window.addEventListener('pointercancel',onUp)
return ()=>{window.removeEventListener('pointermove',onMove)
window.removeEventListener('pointerup',onUp)
window.removeEventListener('pointercancel',onUp)}},[drag,over])
const startDrag=(task:Task,e:React.PointerEvent)=>{if((e.target as HTMLElement).closest('button'))return
dragRef.current={id:task.id,moved:false,x:e.clientX,y:e.clientY}
setDrag(task.id)}
return <AppShell><div className="content-inner"><PageHeading eyebrow="Office workflow" title="Tasks" description="Pointer-based board for desktop and touch devices." action={<button className="button button-primary"><Plus/>Add task</button>}/><div className="task-board">{mockData.columns.map(col=>{const columnTasks=items.filter(t=>t.columnId===col.id).sort((a,b)=>a.position-b.position)
return <div key={col.id} data-column-id={col.id} className={`task-column ${over?.column===col.id?'drop-target':''}`}><div className="column-head"><h2>{col.name}</h2><span>{columnTasks.filter(t=>!t.done).length}</span></div>{columnTasks.map((task,index)=><TaskCard key={task.id} task={task} dragging={drag===task.id} insertion={over?.column===col.id&&over.index===index} onStart={e=>startDrag(task,e)}/>)}{over?.column===col.id&&over.index>=columnTasks.length&&<span className="drop-indicator" aria-hidden="true"/>}</div>})}</div></div></AppShell>}
function TaskCard({task,dragging,insertion,onStart}:{task:Task;dragging:boolean;insertion:boolean;onStart:(e:React.PointerEvent)=>void}){return <article data-task-id={task.id} className={`task-card ${task.done?'done':''} ${dragging?'is-dragging':''}`} onPointerDown={onStart}>{insertion&&<span className="drop-indicator drop-indicator-top" aria-hidden="true"/>}<strong>{task.text}</strong><div className="task-card-footer">{(task.startDate||task.dueDate)&&<Badge tone={taskDateTone(task)}>{task.done?'Completed':taskDateLabel(task)}</Badge>}<button className="icon-button" aria-label={`Delete ${task.text}`}><X/></button></div></article>}
export function LoginView(){return <main className="auth-page"><div className="auth-card"><div className="brand-row"><Brand size="large" /></div><h1>Welcome back</h1><p>Sign in to your workforce workspace.</p><label>Email<input type="email" placeholder="you@example.com"/></label><label>Password<input type="password" placeholder="••••••••"/></label><div className="error-message" role="alert">Incorrect email or password.</div><button className="button button-primary">Sign in</button></div></main>}
