'use client'

import Link from 'next/link'
import { ArrowRight, CircleAlert, Clock3, UserRound } from 'lucide-react'
import { AppShell, Badge, PageHeading, Panel } from './app-shell'
import { prototypeDate, prototypeVacancy, prototypeShifts, prototypeWorkers, prototypeConfirmations, prototypeAttendance, confirmationLabel, attendanceLabel } from '@/lib/prototype-data'
import { formatDate } from '@/lib/types'

export function PrototypeToday() {
  const [date] = [prototypeDate]
  const assigned = prototypeShifts.filter(s => s.workerId).length
  const confirmed = prototypeConfirmations.filter(c => c.state === 'accepted').length
  const present = prototypeAttendance.filter(a => a.state === 'worked').length
  const manualHoursDue = prototypeVacancy.trackHoursManually && prototypeShifts.some(s => s.workerId && !prototypeAttendance.find(a => a.shiftId === s.id && a.state === 'no_show'))
  return <AppShell title="Operations prototype">
    <div className="content-inner prototype-page">
      <div className="prototype-kicker"><span>Prototype workspace</span><Link href="/" className="text-button">Back to current site <ArrowRight /></Link></div>
      <PageHeading eyebrow="Dispatcher desk" title="Today" description="Record attendance, confirmations and hours that belong to the workday." action={<div className="prototype-date"><button className="button button-secondary">←</button><strong>{formatDate(date)}</strong><button className="button button-secondary">→</button></div>} />
      <div className="prototype-metrics">
        <div className="prototype-metric"><span>Ordered</span><strong>5</strong><small>client demand</small></div>
        <div className="prototype-metric"><span>Assigned</span><strong>{assigned}</strong><small>people on the plan</small></div>
        <div className="prototype-metric metric-pending"><span>Confirmed</span><strong>{confirmed}</strong><small>waiting for {assigned - confirmed} replies</small></div>
        <div className="prototype-metric metric-danger"><span>Present</span><strong>{present}</strong><small>attendance recorded</small></div>
      </div>
      {manualHoursDue && <div className="hours-reminder"><Clock3 /><div><strong>Manual hours need confirming</strong><span>{prototypeVacancy.title} · enter and save the actual hours before closing the day.</span></div><Link href="/hours" className="button button-secondary button-small">Open hours</Link></div>}
      <div className="prototype-dashboard-grid">
        <Panel className="roster-panel">
          <div className="panel-header"><div><h2>Today’s roster</h2><p>Confirmation and attendance belong on the person’s row.</p></div><UserRound /></div>
          <div className="prototype-roster-list">{prototypeWorkers.slice(0, 5).map((w, i) => { const c = prototypeConfirmations[i]; const a = prototypeAttendance[i]; return <div className={`prototype-roster-row ${a?.state === 'no_show' || a?.state === 'left_early' ? 'attendance-danger' : ''}`} key={w.id}><span className="roster-avatar">{w.initials}</span><span className="roster-person"><strong>{w.fullName}</strong><small>{prototypeVacancy.title} · {i === 0 ? 'Slego / Inbound' : 'Slego / Outbound'}</small></span><Badge tone={c?.state === 'accepted' ? 'green' : c?.state === 'no_response' ? 'orange' : 'blue'}>{c ? confirmationLabel[c.state] : 'Not contacted'}</Badge><Badge tone={a?.state === 'no_show' ? 'urgent' : a?.state === 'worked' ? 'green' : 'neutral'}>{a ? attendanceLabel[a.state] : 'Not started'}</Badge></div> })}</div>
        </Panel>
        <Panel className="shift-overview-panel">
          <div className="panel-header"><div><h2>Next shifts</h2><p>Ordered → assigned → confirmed → present</p></div><Clock3 /></div>
          <div className="shift-overview"><div className="shift-overview-head"><strong>Warehouse · Slego</strong><Badge tone="urgent">2 open</Badge></div><span className="shift-time">06:00–16:00 · Inbound</span><div className="shift-counts"><b>3</b> assigned <b>2</b> confirmed <b>1</b> present · <b>1</b> no-show</div></div>
          <div className="shift-overview"><div className="shift-overview-head"><strong>Warehouse · Conakryweg</strong><Badge tone="green">Recorded</Badge></div><span className="shift-time">07:00–16:00 · General work</span><div className="shift-counts"><b>1</b> assigned <b>1</b> confirmed <b>1</b> present</div></div>
          <Link className="panel-footer-link" href={`/prototype/vacancies/${prototypeVacancy.id}`}>Open full schedule <ArrowRight /></Link>
        </Panel>
      </div>
      <div className="prototype-callout"><CircleAlert /><div><strong>Operational record, not a reminder list</strong><span>The company planner remains the place for things they do not want to forget. This workspace records who confirmed, who arrived, who did not, and which manual hours still need saving.</span></div></div>
    </div>
  </AppShell>
}
