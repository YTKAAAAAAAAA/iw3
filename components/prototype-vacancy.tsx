'use client'

import Link from 'next/link'
import { useMemo, useState } from 'react'
import { ArrowLeft, ArrowRight, Check, Clock3, FileCheck2, MapPin, MessageCircle, MoreHorizontal, RefreshCw, ShieldCheck, UserPlus, X } from 'lucide-react'
import { AppShell, Badge, PageHeading, Panel, StateBlock, useExit } from './app-shell'
import { coverageSegments, clockLabel, candidateFit, confirmationFor, attendanceFor, type Fit } from '@/lib/prototype-derive'
import { prototypeAttendance, prototypeChanges, prototypeConfirmations, prototypeDate, prototypeDemand, prototypeRequirements, prototypeShifts, prototypeVacancy, confirmationLabel, attendanceLabel } from '@/lib/prototype-data'
import { workers } from '@/lib/mock-data'
import { formatDate, type PrototypeConfirmation, type RosterEntry } from '@/lib/types'

const toneForFit: Record<Fit, 'green' | 'orange' | 'urgent'> = { eligible: 'green', warning: 'orange', blocked: 'urgent' }
const fitLabel: Record<Fit, string> = { eligible: 'Eligible', warning: 'Warning', blocked: 'Blocked' }

export function PrototypeVacancy() {
  const [plan, setPlan] = useState<RosterEntry[]>(prototypeShifts)
  const [confirmations, setConfirmations] = useState<PrototypeConfirmation[]>(prototypeConfirmations)
  const [covering, setCovering] = useState<RosterEntry | null>(null)
  const [activeTab, setActiveTab] = useState<'schedule' | 'requirements' | 'changes'>('schedule')
  const [showInstructions, setShowInstructions] = useState(false)
  const [notice, setNotice] = useState('')
  const demand = prototypeDemand.find(row => row.section === 'Inbound') ?? prototypeDemand[0]
  const visibleShifts = plan.filter(shift => shift.placeId === demand.placeId && shift.section === demand.section)
  const displayShifts = visibleShifts.map((shift, index) => ({
    ...shift,
    start: index === 0 ? demand.start : shift.start,
  }))
  const summary = useMemo(() => {
    const assigned = visibleShifts.filter(shift => shift.workerId && shift.outcome !== 'cancelled')
    const confirmed = assigned.filter(shift => confirmationFor(confirmations, shift.id)?.state === 'accepted')
    const present = assigned.filter(shift => {
      const state = attendanceFor(prototypeAttendance, shift.id)?.state
      return state === 'present' || state === 'late' || state === 'worked'
    })
    return { ordered: demand.headcount, assigned: assigned.length, confirmed: confirmed.length, present: present.length }
  }, [confirmations, demand, visibleShifts])
  const segments = useMemo(() => coverageSegments(demand, displayShifts), [demand, displayShifts])

  const markConfirmed = (shiftId: string) => {
    setConfirmations(current => current.map(item => item.shiftId === shiftId ? { ...item, state: 'accepted', note: 'Confirmed just now' } : item))
    setNotice('Confirmation marked as received')
  }
  const addCover = (workerId: string, original: RosterEntry) => {
    const id = `prototype-cover-${Date.now()}`
    setPlan(current => [...current, { ...original, id, workerId, start: '12:00', end: original.end, outcome: 'planned', coversShiftId: original.id, note: 'Cover from 12:00' }])
    setCovering(null)
    setNotice(`${workers.find(worker => worker.id === workerId)?.fullName ?? 'Worker'} added as cover from 12:00`)
  }

  return <AppShell title="Operations prototype">
    <div className="content-inner prototype-page">
      <div className="prototype-kicker"><Link href="/prototype" className="text-button"><ArrowLeft />Today</Link><span>Operations prototype</span></div>
      <PageHeading eyebrow="Vacancy operations" title={prototypeVacancy.title} description={`${prototypeVacancy.address} · ${formatDate(prototypeDate)}`} action={<div className="prototype-detail-actions"><Badge tone="urgent">Needs attention</Badge><button className="button button-secondary" onClick={() => setShowInstructions(value => !value)}><MapPin />Site instructions</button></div>} />

      {notice && <div className="prototype-toast" role="status"><Check />{notice}<button className="icon-button" onClick={() => setNotice('')} aria-label="Dismiss"><X /></button></div>}

      <div className="prototype-detail-summary">
        <Summary label="Ordered" value={summary.ordered} note="client demand" />
        <Summary label="Assigned" value={summary.assigned} note="on the plan" />
        <Summary label="Confirmed" value={summary.confirmed} note={`${summary.assigned - summary.confirmed} awaiting reply`} tone="pending" />
        <Summary label="Present" value={summary.present} note={`${Math.max(0, summary.ordered - summary.present)} open now`} tone="danger" />
      </div>

      {showInstructions && <Panel className="prototype-instructions"><div className="panel-header"><div><h2>Before people arrive</h2><p>Information that belongs with this site, not hidden in a note.</p></div><button className="icon-button" onClick={() => setShowInstructions(false)} aria-label="Close instructions"><X /></button></div><div className="instruction-grid"><div><span>Site contact</span><strong>Mark de Wit · +31 30 555 0102</strong></div><div><span>Arrival</span><strong>06:45 at gate B · ask for Eva</strong></div><div><span>Equipment</span><strong>Safety shoes and high-visibility vest</strong></div><div><span>Parking</span><strong>Use the east lot; badge at reception</strong></div></div></Panel>}

      <div className="prototype-tabs" role="tablist" aria-label="Vacancy information"><button className={activeTab === 'schedule' ? 'active' : ''} onClick={() => setActiveTab('schedule')}>Schedule <b>1</b></button><button className={activeTab === 'requirements' ? 'active' : ''} onClick={() => setActiveTab('requirements')}>Requirements <b>{prototypeRequirements.length}</b></button><button className={activeTab === 'changes' ? 'active' : ''} onClick={() => setActiveTab('changes')}>Changes <b>{prototypeChanges.length}</b></button></div>

      {activeTab === 'schedule' && <div className="prototype-detail-grid">
        <Panel className="prototype-shift-panel"><div className="panel-header"><div><h2>Slego · Inbound</h2><p>06:00–16:00 · Wednesday 19 June</p></div><Badge tone={summary.present < summary.ordered ? 'urgent' : 'green'}>{summary.present}/{summary.ordered} present</Badge></div><CoverageBar segments={segments} required={demand.headcount} /><div className="coverage-caption"><span><i className="coverage-key covered" />Covered</span><span><i className="coverage-key gap" />Uncovered</span><strong>{segments.filter(segment => segment.gap > 0).map(segment => `${clockLabel(segment.from)}–${clockLabel(segment.to)}`).join(', ') || 'No coverage gaps'}</strong></div><div className="prototype-shift-list">{displayShifts.map(shift => <ShiftRow key={shift.id} shift={shift} confirmation={confirmationFor(confirmations, shift.id)} attendance={attendanceFor(prototypeAttendance, shift.id)} onConfirm={() => markConfirmed(shift.id)} onCover={() => setCovering(shift)} />)}</div><button className="prototype-add-row" onClick={() => setNotice('Add person flow is ready for the next prototype pass')}><UserPlus />Add person to this slot</button></Panel>
        <div className="prototype-side-stack"><Panel><div className="panel-header"><div><h2>What happens next</h2><p>The order is not closed until each layer is done.</p></div><Clock3 /></div><Lifecycle summary={summary} /></Panel><Panel><div className="panel-header"><div><h2>Dispatcher notes</h2><p>Keep the decision close to the shift.</p></div><MessageCircle /></div><p className="prototype-note">The client asked for an early start today. Fatima left at 10:00 because she felt ill. The two-hour gap is real and needs a cover decision.</p><button className="button button-secondary button-small"><MessageCircle />Message affected people</button></Panel></div>
      </div>}

      {activeTab === 'requirements' && <RequirementsPanel />}
      {activeTab === 'changes' && <ChangesPanel />}
      {covering && <CoverDrawer original={covering} onClose={() => setCovering(null)} onSelect={workerId => addCover(workerId, covering)} />}
    </div>
  </AppShell>
}

function Summary({ label, value, note, tone = '' }: { label: string; value: number; note: string; tone?: string }) { return <div className={`prototype-summary ${tone}`}><span>{label}</span><strong>{value}</strong><small>{note}</small></div> }

function CoverageBar({ segments, required }: { segments: ReturnType<typeof coverageSegments>; required: number }) { return <div className="coverage-bar" aria-label={`${required} people required across the shift`}>{segments.map(segment => <span key={`${segment.from}-${segment.to}`} className={segment.gap ? 'gap' : 'covered'} style={{ width: `${Math.max(2, ((segment.to - segment.from) / 600) * 100)}%` }} title={`${clockLabel(segment.from)}–${clockLabel(segment.to)} · ${segment.present}/${segment.required}`}><i style={{ width: `${Math.min(100, (segment.present / Math.max(1, segment.required)) * 100)}%` }} /></span>)}</div> }

function ShiftRow({ shift, confirmation, attendance, onConfirm, onCover }: { shift: RosterEntry; confirmation: PrototypeConfirmation | null; attendance: ReturnType<typeof attendanceFor>; onConfirm: () => void; onCover: () => void }) {
  const worker = workers.find(item => item.id === shift.workerId)
  const needsCover = attendance?.state === 'left_early' || attendance?.state === 'no_show'
  return <div className={`prototype-shift-row ${needsCover ? 'needs-cover' : ''}`}><span className="shift-index">{worker?.initials ?? '—'}</span><span className="prototype-shift-person"><strong>{worker?.fullName ?? 'Unassigned'}</strong><small>{shift.start}–{attendance?.actualEnd ?? shift.end} {shift.coversShiftId ? '· cover' : ''}</small></span><span className="shift-statuses"><Badge tone={confirmation?.state === 'accepted' ? 'green' : confirmation?.state === 'no_response' ? 'orange' : 'blue'}>{confirmation ? confirmationLabel[confirmation.state] : 'Not contacted'}</Badge><Badge tone={attendance?.state === 'no_show' || attendance?.state === 'left_early' ? 'urgent' : attendance?.state === 'late' ? 'orange' : 'neutral'}>{attendance ? attendanceLabel[attendance.state] : 'Not started'}</Badge></span><span className="shift-row-action">{needsCover ? <button className="button button-primary button-small" onClick={onCover}><RefreshCw />Find cover</button> : confirmation?.state !== 'accepted' ? <button className="button button-secondary button-small" onClick={onConfirm}>Mark confirmed</button> : <button className="icon-button" aria-label={`Actions for ${worker?.fullName ?? 'worker'}`}><MoreHorizontal /></button>}</span></div>
}

function Lifecycle({ summary }: { summary: { ordered: number; assigned: number; confirmed: number; present: number } }) { const steps = [['Ordered', summary.ordered, 'blue'], ['Assigned', summary.assigned, 'blue'], ['Confirmed', summary.confirmed, 'green'], ['Present', summary.present, summary.present < summary.ordered ? 'orange' : 'green']] as const; return <div className="prototype-lifecycle">{steps.map(([label, value, tone], index) => <div key={label} className="lifecycle-step"><span className={`lifecycle-dot ${tone}`}>{index < 2 ? '·' : index === 2 ? '✓' : '!'}</span><span><strong>{label}</strong><small>{value} people</small></span></div>)}</div> }

function RequirementsPanel() { return <div className="prototype-detail-grid"><Panel><div className="panel-header"><div><h2>What this vacancy requires</h2><p>Requirements explain why someone can or cannot be offered a shift.</p></div><ShieldCheck /></div><div className="requirement-list">{prototypeRequirements.map(item => <div className="requirement-row" key={item.id}><span className={`requirement-icon ${item.kind}`}><FileCheck2 /></span><span><strong>{item.label}</strong><small>{item.required ? 'Required for this site' : 'Preferred when available'}</small></span><Badge tone={item.required ? 'orange' : 'neutral'}>{item.required ? 'Required' : 'Preferred'}</Badge></div>)}</div></Panel><Panel><div className="panel-header"><div><h2>Candidate language</h2><p>Show the reason, not just a disabled button.</p></div></div><div className="fit-legend"><Badge tone="green">Eligible</Badge><Badge tone="orange">Warning</Badge><Badge tone="urgent">Blocked</Badge></div><p className="prototype-note">A dispatcher can still choose a warning candidate after acknowledging the trade-off. Hard blocks stay visible so the team can fix the underlying data.</p></Panel></div> }

function ChangesPanel() { return <Panel className="prototype-changes-panel"><div className="panel-header"><div><h2>Change history</h2><p>Small changes become operational tasks when they happen close to start time.</p></div></div><div className="change-list">{prototypeChanges.map(change => <div className="change-row" key={change.id}><span className="change-time">{new Date(change.at).toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' })}</span><span><strong>{change.author}</strong><small>{change.text}</small></span><Badge tone={change.type === 'assignment' ? 'green' : change.type === 'time' ? 'orange' : 'blue'}>{change.type}</Badge></div>)}</div></Panel> }

function CoverDrawer({ original, onClose, onSelect }: { original: RosterEntry; onClose: () => void; onSelect: (workerId: string) => void }) { const { closing, close } = useExit(onClose); const outgoing = workers.find(worker => worker.id === original.workerId); const candidates = workers.filter(worker => worker.status === 'active' && worker.id !== original.workerId).slice(0, 8).map(worker => { const hard: string[] = []; const soft: string[] = []; if (!worker.hasCar) hard.push('No car — site requires one'); if (!worker.hasVog) hard.push('VOG is not on file'); if (worker.courseDays.includes('wed')) hard.push('At a course on Wednesday'); if (worker.id === 'w-02') soft.push('Only 8h rest before this shift'); if (worker.id === 'w-03') soft.push('Already has a preferred assignment'); return { worker, result: candidateFit({ hard, soft }) } }); return <div className={`dialog-backdrop ${closing ? 'closing' : ''}`} onClick={close}><aside className="prototype-cover-drawer" onClick={event => event.stopPropagation()}><div className="panel-header"><div><p className="eyebrow">Replacement workflow</p><h2>Find cover</h2><p>{outgoing?.fullName ?? 'Worker'} · {attendanceLabel[attendanceFor(prototypeAttendance, original.id)?.state ?? 'not_started']}</p></div><button className="icon-button" onClick={close} aria-label="Close"><X /></button></div><div className="cover-context"><strong>Cover needed from 10:00</strong><span>Slego · Inbound · {formatDate(prototypeDate)}</span><small>The original shift stays in the history. A new cover shift will be linked to it.</small></div><div className="cover-candidates">{candidates.map(({ worker, result }) => <button key={worker.id} className={`cover-candidate ${result.fit}`} disabled={result.fit === 'blocked'} onClick={() => onSelect(worker.id)}><span className="roster-avatar">{worker.initials}</span><span><strong>{worker.fullName}</strong><small>{result.reasons[0] ?? '18 km · 24 min · available'}</small>{result.reasons.slice(1).map(reason => <small key={reason}>{reason}</small>)}</span><Badge tone={toneForFit[result.fit]}>{fitLabel[result.fit]}</Badge><ArrowRight /></button>)}</div><div className="form-footer"><button className="button button-secondary" onClick={close}>Cancel</button><button className="button button-secondary" onClick={() => { setTimeout(() => onClose(), 0) }}>Skip for now</button></div></aside></div> }
