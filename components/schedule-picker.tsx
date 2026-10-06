'use client'

import { useMemo, useState } from 'react'
import dynamic from 'next/dynamic'
import { Bike, Car, Eye, EyeOff, HelpCircle, Search, Undo2, UserX, X } from 'lucide-react'
import { useExit } from './app-shell'
import { useWorkforceData } from './workforce-data-context'
import type { CandidateVisibility } from './workforce-data-context'
import type { PickerPerson, PickerStatus, Transport } from './schedule-picker-map'
import { useLanguage } from '@/lib/i18n'
import type { Offer, Vacancy, Worker } from '@/lib/types'
import { timeRange } from '@/lib/derive'

/* Leaflet touches `window` on import, so the map half is loaded in the browser only. */
const PickerMap = dynamic(() => import('./schedule-picker-map').then(m => m.PickerMap), {
  ssr: false,
  loading: () => <div className="picker-map picker-map-loading" />,
})

export type PickerCandidate = {
  w: Worker
  busy: boolean
  onLeave: boolean
  noCar: boolean
  duplicate: boolean
  onCourse: boolean
  requirements: { blocked: string[]; warnings: string[] }
  elsewhere: { vacancyId: string } | null
  /** Their other shifts that day; `blocked` by the one-hour rule or not. */
  sameDay: { job: string; start: string | null; end: string | null; blocked: boolean }[]
  travel: { km: number; minutes: number } | null
}

const STATUS_ORDER: PickerStatus[] = ['free', 'other', 'busy', 'leave', 'blocked']
type TransportFilter = 'any' | 'car' | 'bike' | 'carOrBike'
type VogFilter = 'any' | 'onFile'

export const transportOf = (w: Worker): Transport =>
  w.hasCar === true && w.hasBike === true
    ? 'both'
    : w.hasCar === true
      ? 'car'
      : w.hasBike === true
        ? 'bike'
        : w.hasCar === false
          ? 'none'
          : 'unknown'

/* ------------------------------------------------------------------
   Picking people for a slot: tick several at once, on a map that shows where
   they live and how they get there, instead of assigning one row at a time
   from a list of kilometres.
   ------------------------------------------------------------------ */
export function PeoplePicker({
  vacancy,
  title,
  subtitle,
  date,
  ordered,
  staffed,
  candidates,
  visibility,
  setVisibility,
  offerFor,
  onAssign,
  onOffer,
  onClose,
}: {
  vacancy: Vacancy
  title: string
  subtitle: string
  date: string
  ordered: number
  staffed: number
  candidates: PickerCandidate[]
  visibility: CandidateVisibility[]
  setVisibility: (update: (current: CandidateVisibility[]) => CandidateVisibility[]) => void
  offerFor: (workerId: string, date: string) => Offer | null
  onAssign: (workerIds: string[]) => void
  onOffer: (workerIds: string[], status: 'offered' | 'declined' | null) => void
  onClose: () => void
}) {
  const { t } = useLanguage()
  const { vacancies, homeAreas } = useWorkforceData()
  const { closing, close } = useExit(onClose)
  const [selected, setSelected] = useState<Set<string>>(new Set())
  const [transport, setTransport] = useState<TransportFilter>('any')
  const [vog, setVog] = useState<VogFilter>('any')
  const [onlyAvailable, setOnlyAvailable] = useState(true)
  const [radius, setRadius] = useState<number | null>(null)
  const [query, setQuery] = useState('')
  const [showHidden, setShowHidden] = useState(false)
  const [hovered, setHovered] = useState<string | null>(null)
  const [visibilityError, setVisibilityError] = useState('')
  const [pending, setPending] = useState<string[]>([])

  const homes = useMemo(() => new Map(homeAreas.map(h => [h.workerId, h])), [homeAreas])
  const isHidden = (workerId: string) => {
    const day = visibility.find(item => item.workerId === workerId && item.date === date)
    if (day) return day.hidden
    return visibility.find(item => item.workerId === workerId && item.date === null)?.hidden ?? false
  }

  const rows = useMemo(
    () =>
      candidates
        .map(c => {
          const offer = offerFor(c.w.id, date)
          const where = (shift: PickerCandidate['sameDay'][number]) =>
            [shift.job, timeRange(shift.start, shift.end, t)].filter(Boolean).join(' ')
          const blocking = c.sameDay.find(shift => shift.blocked)
          const other = c.sameDay.filter(shift => !shift.blocked)
          const status: PickerStatus = c.onLeave
            ? 'leave'
            : c.busy || c.duplicate
              ? 'busy'
              : c.noCar || c.onCourse || c.requirements.blocked.length
                ? 'blocked'
                : other.length
                  ? 'other'
                  : 'free'
          const reason = c.duplicate
            ? t('already in this slot')
            : c.onLeave
              ? t('on leave')
              : blocking
                ? t('works at {job} — less than an hour apart', { job: where(blocking) })
                : c.noCar
                  ? t('no car — this site needs one')
                  : c.onCourse
                    ? t('at a course this weekday')
                    : c.requirements.blocked.length
                      ? c.requirements.blocked.join(' · ')
                      : other.length
                        ? t('also works at {job}', { job: other.map(where).join('; ') })
                        : t('free')
          return { ...c, offer, status, reason, transport: transportOf(c.w), hidden: isHidden(c.w.id) }
        })
        .sort(
          (a, b) =>
            Number(a.offer?.status === 'declined') - Number(b.offer?.status === 'declined') ||
            STATUS_ORDER.indexOf(a.status) - STATUS_ORDER.indexOf(b.status) ||
            (a.travel?.km ?? 1e9) - (b.travel?.km ?? 1e9) ||
            a.w.fullName.localeCompare(b.w.fullName),
        ),
    // isHidden reads `visibility`, listed here.
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [candidates, date, offerFor, vacancies, visibility, t],
  )

  const transportOk = (value: Transport) =>
    transport === 'any' ||
    (transport === 'car' && (value === 'car' || value === 'both')) ||
    (transport === 'bike' && (value === 'bike' || value === 'both')) ||
    (transport === 'carOrBike' && value !== 'none' && value !== 'unknown')
  const needle = query.trim().toLowerCase()
  const selectableStatus = (status: PickerStatus) => status === 'free' || status === 'other'
  const shown = rows.filter(
    row =>
      (!onlyAvailable || selectableStatus(row.status) || selected.has(row.w.id)) &&
      transportOk(row.transport) &&
      (vog === 'any' || row.w.hasVog === true) &&
      (radius === null || (row.travel !== null && row.travel.km <= radius)) &&
      (!needle || row.w.fullName.toLowerCase().includes(needle)) &&
      (showHidden || !row.hidden || selected.has(row.w.id)),
  )
  const hiddenCount = rows.filter(row => row.hidden).length
  const withoutHome = shown.filter(row => !homes.has(row.w.id)).length

  const toggle = (id: string) =>
    setSelected(cur => {
      const next = new Set(cur)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })

  const mapPeople: PickerPerson[] = shown.flatMap(row => {
    const home = homes.get(row.w.id)
    if (!home) return []
    const transportLabel =
      row.transport === 'both'
        ? t('car and bike')
        : row.transport === 'car'
          ? t('car')
          : row.transport === 'bike'
            ? t('bike')
            : row.transport === 'none'
              ? t('no own transport')
              : t('transport unknown')
    return [
      {
        id: row.w.id,
        name: row.w.fullName,
        lat: home.lat,
        lon: home.lon,
        status: row.status,
        transport: row.transport,
        detail: [row.travel ? `${row.travel.km} km · ${row.travel.minutes} min` : null, transportLabel, row.reason]
          .filter(Boolean)
          .join(' · '),
        selected: selected.has(row.w.id),
        selectable: selectableStatus(row.status),
      },
    ]
  })

  const changeVisibility = async (workerId: string, hidden: boolean) => {
    setPending(cur => [...cur, workerId])
    setVisibilityError('')
    try {
      const response = await fetch(`/api/vacancies/${encodeURIComponent(vacancy.id)}/candidate-visibility`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(hidden ? { workerId, date: null, hidden: true } : { workerId, date: null, reset: true }),
      })
      if (!response.ok) {
        const result: unknown = await response.json().catch(() => null)
        throw new Error(
          typeof result === 'object' && result !== null && 'error' in result && typeof result.error === 'string'
            ? result.error
            : 'Could not update this person’s visibility.',
        )
      }
      setVisibility(cur =>
        hidden
          ? [
              ...cur.filter(item => !(item.workerId === workerId && item.date === null)),
              { vacancyId: vacancy.id, workerId, date: null, hidden: true },
            ]
          : [
              ...cur.filter(item => item.workerId !== workerId),
              { vacancyId: vacancy.id, workerId, date: null, hidden: false },
            ],
      )
      if (hidden) setSelected(cur => new Set([...cur].filter(id => id !== workerId)))
    } catch (cause) {
      setVisibilityError(cause instanceof Error ? cause.message : 'Could not update this person’s visibility.')
    } finally {
      setPending(cur => cur.filter(id => id !== workerId))
    }
  }

  const chosen = [...selected]
  const left = Math.max(0, ordered - staffed)
  const over = chosen.length - left
  const site = vacancy.lat !== null && vacancy.lon !== null ? { lat: vacancy.lat, lon: vacancy.lon, title: vacancy.title } : null

  return (
    <div className={`dialog-backdrop ${closing ? 'closing' : ''}`} onClick={close}>
      <section
        className="picker-sheet"
        role="dialog"
        aria-modal="true"
        aria-labelledby="picker-title"
        onClick={event => event.stopPropagation()}
      >
        <header className="picker-head">
          <div>
            <h2 id="picker-title">{title}</h2>
            <p>{subtitle}</p>
          </div>
          <span className={`picker-count ${staffed < ordered ? 'short' : staffed > ordered ? 'over' : 'full'}`}>
            {t('{staffed} of {ordered} staffed', { staffed, ordered })}
          </span>
          <button className="icon-button" onClick={close} aria-label={t('Close')}>
            <X />
          </button>
        </header>

        <div className="picker-filters">
          <label className="picker-search">
            <Search />
            <input
              value={query}
              onChange={event => setQuery(event.target.value)}
              placeholder={t('Search a name')}
              aria-label={t('Search a name')}
            />
          </label>
          <div className="seg seg-small" role="group" aria-label={t('Own transport')}>
            {(
              [
                ['any', 'Any transport'],
                ['car', 'Car'],
                ['bike', 'Bike'],
                ['carOrBike', 'Car or bike'],
              ] as const
            ).map(([value, label]) => (
              <button
                key={value}
                type="button"
                aria-pressed={transport === value}
                className={transport === value ? 'active' : ''}
                onClick={() => setTransport(value)}
              >
                {t(label)}
              </button>
            ))}
          </div>
          <div className="seg seg-small" role="group" aria-label="VOG">
            {(
              [
                ['any', 'VOG: any'],
                ['onFile', 'VOG on file'],
              ] as const
            ).map(([value, label]) => (
              <button
                key={value}
                type="button"
                aria-pressed={vog === value}
                className={vog === value ? 'active' : ''}
                onClick={() => setVog(value)}
              >
                {t(label)}
              </button>
            ))}
          </div>
          <label className="picker-radius">
            {t('Within')}
            <select
              value={radius ?? ''}
              onChange={event => setRadius(event.target.value ? Number(event.target.value) : null)}
            >
              <option value="">{t('any distance')}</option>
              {[5, 10, 20, 30, 50].map(km => (
                <option key={km} value={km}>
                  {km} km
                </option>
              ))}
            </select>
          </label>
          <label className="checkbox-inline">
            <input type="checkbox" checked={onlyAvailable} onChange={event => setOnlyAvailable(event.target.checked)} />
            {t('Only free people')}
          </label>
          {hiddenCount > 0 && (
            <button type="button" className="text-button" onClick={() => setShowHidden(value => !value)}>
              {showHidden ? t('Hide hidden people') : t('Show hidden · {count}', { count: hiddenCount })}
            </button>
          )}
        </div>

        <div className="picker-body">
          <div className="picker-map-wrap">
            {site ? (
              <PickerMap
                site={site}
                people={mapPeople}
                radiusKm={radius}
                highlighted={hovered}
                onToggle={toggle}
                onHover={setHovered}
              />
            ) : (
              <p className="picker-map picker-map-empty">
                {t('This vacancy has no address on the map yet. Add one in the vacancy details.')}
              </p>
            )}
            <div className="picker-legend">
              <span>
                <i className="dot status-free" />
                {t('free')}
              </span>
              <span>
                <i className="dot status-other" />
                {t('works elsewhere that day')}
              </span>
              <span>
                <i className="dot status-busy" />
                {t('cannot — under an hour apart')}
              </span>
              <span>
                <i className="dot status-leave" />
                {t('on leave')}
              </span>
              <span>
                <i className="dot status-blocked" />
                {t('does not fit')}
              </span>
              {withoutHome > 0 && (
                <span className="picker-legend-note">
                  {t('{count} without a home address — in the list only', { count: withoutHome })}
                </span>
              )}
            </div>
          </div>

          <div className="picker-list" role="list">
            {visibilityError && (
              <p className="dialog-note" role="alert">
                {t(visibilityError)}
              </p>
            )}
            {!shown.length && (
              <p className="picker-empty">
                {candidates.length
                  ? t('Nobody matches these filters.')
                  : t('No active worker has access to this client.')}
              </p>
            )}
            {shown.map(row => {
              const isSelected = selected.has(row.w.id)
              const selectable = selectableStatus(row.status)
              return (
                <div
                  key={row.w.id}
                  role="listitem"
                  className={`picker-row status-${row.status} ${isSelected ? 'selected' : ''} ${row.offer?.status === 'declined' ? 'declined' : ''} ${hovered === row.w.id ? 'highlighted' : ''}`}
                  onMouseEnter={() => setHovered(row.w.id)}
                  onMouseLeave={() => setHovered(null)}
                >
                  <label className="picker-pick">
                    <input
                      type="checkbox"
                      checked={isSelected}
                      disabled={!selectable && !isSelected}
                      onChange={() => toggle(row.w.id)}
                    />
                    <span className="picker-name">
                      <strong>{row.w.fullName}</strong>
                      <small>
                        <i className={`dot status-${row.status}`} />
                        {row.reason}
                        {row.offer && ` · ${row.offer.status === 'declined' ? t('declined') : t('offered')}`}
                        {row.hidden && ` · ${t('hidden')}`}
                        {row.requirements.warnings.map(warning => ` · ${t(warning)}`)}
                      </small>
                    </span>
                  </label>
                  <span className="picker-transport" title={t('Own transport')}>
                    {row.transport === 'car' || row.transport === 'both' ? <Car aria-label={t('car')} /> : null}
                    {row.transport === 'bike' || row.transport === 'both' ? <Bike aria-label={t('bike')} /> : null}
                    {row.transport === 'unknown' ? <HelpCircle aria-label={t('transport unknown')} /> : null}
                    {row.transport === 'none' ? <small>{t('none')}</small> : null}
                  </span>
                  <span className="picker-distance">
                    {row.travel ? (
                      <>
                        <strong>{row.travel.km} km</strong>
                        <small>{row.travel.minutes} min</small>
                      </>
                    ) : (
                      <small>{t('no address')}</small>
                    )}
                  </span>
                  <span className="picker-row-actions">
                    <button
                      type="button"
                      className="icon-button"
                      title={row.offer?.status === 'declined' ? t('Clear “declined”') : t('Mark as declined')}
                      aria-label={row.offer?.status === 'declined' ? t('Clear “declined”') : t('Mark as declined')}
                      onClick={() => onOffer([row.w.id], row.offer?.status === 'declined' ? null : 'declined')}
                    >
                      {row.offer?.status === 'declined' ? <Undo2 /> : <UserX />}
                    </button>
                    <button
                      type="button"
                      className="icon-button"
                      disabled={pending.includes(row.w.id)}
                      title={row.hidden ? t('Show in selection again') : t('Hide from selection')}
                      aria-label={row.hidden ? t('Show in selection again') : t('Hide from selection')}
                      onClick={() => void changeVisibility(row.w.id, !row.hidden)}
                    >
                      {row.hidden ? <Eye /> : <EyeOff />}
                    </button>
                  </span>
                </div>
              )
            })}
          </div>
        </div>

        <footer className="picker-foot">
          <div className="picker-summary">
            <strong>{t('{count} selected', { count: chosen.length })}</strong>
            <span>
              {left > 1 ? t('{left} places left', { left }) : left === 1 ? t('1 place left') : t('The slot is full')}
              {chosen.length > 0 && over > 0 && (
                <em className="picker-over"> · {t('{count} more than ordered', { count: over })}</em>
              )}
            </span>
          </div>
          {chosen.length > 0 && (
            <button type="button" className="button button-secondary" onClick={() => setSelected(new Set())}>
              {t('Clear')}
            </button>
          )}
          <button
            type="button"
            className="button button-secondary"
            disabled={!chosen.length}
            onClick={() => {
              onOffer(chosen, 'offered')
              setSelected(new Set())
            }}
          >
            {t('Mark offered')}
          </button>
          <button
            type="button"
            className="button button-primary"
            disabled={!chosen.length}
            onClick={() => {
              onAssign(chosen)
              close()
            }}
          >
            {chosen.length ? t('Assign {count}', { count: chosen.length }) : t('Assign')}
          </button>
        </footer>
      </section>
    </div>
  )
}
