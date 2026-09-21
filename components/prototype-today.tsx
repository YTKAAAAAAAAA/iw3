'use client'

import Link from 'next/link'
import { AlertTriangle, ArrowRight, Bell, Check, CircleAlert, Clock3, FileCheck2, RefreshCw, UserRound } from 'lucide-react'
import { AppShell, Badge, PageHeading, Panel } from './app-shell'
import { prototypeAttention, prototypeDate, prototypeVacancy, prototypeShifts, prototypeWorkers, prototypeConfirmations, prototypeAttendance, confirmationLabel, attendanceLabel } from '@/lib/prototype-data'
import { prototypeDemand } from '@/lib/prototype-data'
import { formatDate } from '@/lib/types'

const toneFor = (severity: 'critical' | 'warning' | 'info') => severity === 'critical' ? 'urgent' : severity === 'warning' ? 'orange' : 'blue'
const iconFor = (kind: string) => kind === 'confirmation' ? Bell : kind === 'replacement' ? RefreshCw : kind === 'hours' ? Clock3 : kind === 'client' ? FileCheck2 : AlertTriangle

export function PrototypeToday() {
  const [date] = [prototypeDate]
  const assigned = prototypeShifts.filter(s => s.workerId).length
  const confirmed = prototypeConfirmations.filter(c => c.state === 'accepted').length
  const present = prototypeAttendance.filter(a => ['present', 'late', 'worked'].includes(a.state)).length
  return <AppShell title="Operations prototype">
    <div className="content-inner prototype-page">
      <div className="prototype-kicker"><span>Prototype workspace</span><Link href="/" className="text-button">Back to current site <ArrowRight /></Link></div>
      <PageHeading eyebrow="Dispatcher desk" title="Today" description="A single place to see what needs attention before the next shift starts." action={<div className="prototype-date"><button className="button button-secondary">←</button><strong>{formatDate(date)}</strong><button className="button button-secondary">→</button></div>} />
      <div className="prototype-metrics">
        <div className="prototype-metric"><span>Ordered</span><strong>5</strong><small>client demand</small></div>
        <div className="prototype-metric"><span>Assigned</span><strong>{assigned}</strong><small>people on the plan</small></div>
        <div className="prototype-metric metric-pending"><span>Confirmed</span><strong>{confirmed}</strong><small>waiting for {assigned - confirmed} replies</small></div>
        <div className="prototype-metric metric-danger"><span>Present</span><strong>{present}</strong><small>attendance recorded</small></div>
      </div>
      <div className="prototype-filter-bar"><strong>Work queue</strong><button className="active">All <b>{prototypeAttention.length}</b></button><button>Unconfirmed <b>2</b></button><button>Understaffed <b>2</b></button><button>Client changes <b>1</b></button></div>
      <div className="prototype-dashboard-grid">
        <Panel className="attention-panel">
          <div className="panel-header"><div><h2>Needs attention</h2><p>Problems sorted by what can still be fixed today.</p></div><Badge tone="urgent">{prototypeAttention.filter(a => a.severity === 'critical').length} urgent</Badge></div>
          <div className="attention-list">{prototypeAttention.map(item => { const Icon = iconFor(item.kind); return <div className={`attention-row attention-${item.severity}`} key={item.id}><div className="attention-icon"><Icon /></div><div className="attention-copy"><strong>{item.title}</strong><span>{item.detail}</span><small>{prototypeVacancy.title} · {formatDate(item.date)}</small></div><button className={`button ${item.severity === 'critical' ? 'button-primary' : 'button-secondary'} button-small`}>{item.action}<ArrowRight /></button></div> })}</div>
        </Panel>
        <Panel className="shift-overview-panel">
          <div className="panel-header"><div><h2>Next shifts</h2><p>Ordered → assigned → confirmed → present</p></div><Clock3 /></div>
          <div className="shift-overview"><div className="shift-overview-head"><strong>Warehouse · Slego</strong><Badge tone="urgent">2 open</Badge></div><span className="shift-time">06:00–16:00 · Inbound</span><div className="shift-progress"><i style={{ width: '60%' }} /></div><div className="shift-counts"><b>3</b> assigned <b>2</b> confirmed <b>1</b> present</div></div>
          <div className="shift-overview"><div className="shift-overview-head"><strong>Warehouse · Conakryweg</strong><Badge tone="green">Covered</Badge></div><span className="shift-time">07:00–16:00 · General work</span><div className="shift-progress good"><i style={{ width: '100%' }} /></div><div className="shift-counts"><b>1</b> assigned <b>1</b> confirmed <b>1</b> present</div></div>
          <Link className="panel-footer-link" href={`/prototype/vacancies/${prototypeVacancy.id}`}>Open full schedule <ArrowRight /></Link>
        </Panel>
      </div>
      <div className="prototype-dashboard-grid prototype-bottom-grid">
        <Panel><div className="panel-header"><div><h2>Roster status</h2><p>One line per person, not just a name in a slot.</p></div><UserRound /></div><div className="prototype-roster-list">{prototypeWorkers.slice(0, 5).map((w, i) => { const c = prototypeConfirmations[i]; const a = prototypeAttendance[i]; return <div className="prototype-roster-row" key={w.id}><span className="roster-avatar">{w.initials}</span><span className="roster-person"><strong>{w.fullName}</strong><small>{prototypeVacancy.title} · {i === 0 ? 'Slego / Inbound' : 'Slego / Outbound'}</small></span><Badge tone={c?.state === 'accepted' ? 'green' : c?.state === 'no_response' ? 'orange' : 'blue'}>{c ? confirmationLabel[c.state] : 'Not contacted'}</Badge><Badge tone={a?.state === 'no_show' || a?.state === 'left_early' ? 'urgent' : a?.state === 'late' ? 'orange' : 'neutral'}>{a ? attendanceLabel[a.state] : 'Not started'}</Badge></div> })}</div></Panel>
        <Panel><div className="panel-header"><div><h2>Close the day</h2><p>Do not leave a shift half-finished.</p></div><Check /></div><div className="close-checklist"><label><input type="checkbox" checked readOnly /> Client order reviewed</label><label><input type="checkbox" checked readOnly /> Changes sent to workers</label><label><input type="checkbox" /> No-shows handled</label><label><input type="checkbox" /> Actual hours checked</label><label><input type="checkbox" /> Client report ready</label></div><div className="close-progress"><span>2 of 5 complete</span><i><b /></i></div></Panel>
      </div>
      <div className="prototype-callout"><CircleAlert /><div><strong>This is the missing layer around the schedule</strong><span>The calendar says who is placed. This workspace says who replied, who arrived, what is broken, and what the dispatcher should do next.</span></div></div>
    </div>
  </AppShell>
}
