'use client'

import { useLanguage } from '@/lib/i18n'
import { AddressPicker } from '@/components/address-picker'
import { TimeField } from '@/components/app-shell'
import type { VacancyDraft } from '@/components/vacancies/vacancy-draft'
import { useWorkforceData } from '@/components/workforce-data-context'
import type { RequirementKind } from '@/lib/types'
import { weekdayLabel, WEEKDAYS } from '@/lib/types'
import { useState } from 'react'
import { useToday } from '@/lib/today'

export function VacancyFields({
  draft,
  set,
}: {
  draft: VacancyDraft
  set: (patch: Partial<VacancyDraft>) => void
}) {
  const { t } = useLanguage()
  const today = useToday()
  const { companies } = useWorkforceData()
  const [place, setPlace] = useState('')
  const [requirementLabel, setRequirementLabel] = useState('')
  const [requirementKind, setRequirementKind] = useState<RequirementKind>('skill')
  const addPlace = () => {
    const name = place.trim()
    if (!name) return
    set({ places: [...draft.places, { id: `p-${Date.now()}`, name }] })
    setPlace('')
  }
  return (
    <div className="field-grid">
      <label>
        {t('Title')}
        <input
          value={draft.title}
          placeholder={t('e.g. Inbound warehouse team')}
          onChange={e => set({ title: e.target.value })}
        />
      </label>
      <label>
        {t('Company')}
        <select value={draft.companyId} onChange={e => set({ companyId: e.target.value })}>
          {companies.map(c => (
            <option key={c.id} value={c.id}>
              {c.name}
            </option>
          ))}
        </select>
      </label>
      <div className="wide">
        <label>{t('Site address')}</label>
        <AddressPicker value={draft.address} onChange={a => set({ address: a })} />
      </div>
      <label className="wide">
        {t('Description')}
        <textarea
          value={draft.description}
          placeholder={t('What will the team do?')}
          onChange={e => set({ description: e.target.value })}
        />
      </label>

      <label>
        {t('Start date')}
        <input type="date" value={draft.startDate} onChange={e => set({ startDate: e.target.value })} />
      </label>
      <label>
        {t('End date')}
        <input
          type="date"
          value={draft.endDate ?? ''}
          disabled={draft.endDate === null}
          onChange={e => set({ endDate: e.target.value || null })}
        />
      </label>
      <label className="checkbox-field">
        <input
          type="checkbox"
          checked={draft.endDate === null}
          onChange={e => set({ endDate: e.target.checked ? null : today })}
        />{' '}
        {t('Open-ended vacancy')}
      </label>
      <label>
        {t('People per day')}
        <input
          type="number"
          min={0}
          value={draft.headcount}
          onChange={e => set({ headcount: Math.max(0, Number(e.target.value) || 0) })}
        />
      </label>

      <div className="wide">
        <label>{t('Working days')}</label>
        <div className="seg">
          {WEEKDAYS.map(d => (
            <button
              type="button"
              key={d}
              className={draft.weekdays.includes(d) ? 'active' : ''}
              onClick={() =>
                set({
                  weekdays: draft.weekdays.includes(d)
                    ? draft.weekdays.filter(x => x !== d)
                    : [...draft.weekdays, d],
                })
              }
            >
              {weekdayLabel[d]}
            </button>
          ))}
        </div>
        <p className="field-hint">
          {t(
            'The days the client works. Leave them all off when there is no weekly pattern — then nothing is generated and each day is entered as the client orders it.',
          )}
        </p>
      </div>

      <div className="wide">
        <label>{t('Times')}</label>
        <div className="seg">
          {(
            [
              ['window', 'Start and end'],
              ['start', 'Start only'],
              ['none', 'No times'],
            ] as const
          ).map(([value, label]) => (
            <button
              type="button"
              key={value}
              className={draft.timing === value ? 'active' : ''}
              onClick={() => set({ timing: value })}
            >
              {label}
            </button>
          ))}
        </div>
        <p className="field-hint">
          {draft.timing === 'window'
            ? t('A normal window — 07:00–16:00. Overtime extends the end.')
            : draft.timing === 'start'
              ? t(
                  'People are told when to be there and go home when the work is done. The rest of that day stays blocked for them.',
                )
              : t(
                  'Nothing is written down but who was there. Use this where times are pointless or the client keeps them.',
                )}
        </p>
      </div>
      {draft.timing !== 'none' && (
        <label>
          {t('Usual start')}
          <TimeField value={draft.start} label="Usual start" onChange={v => set({ start: v })} />
        </label>
      )}
      {draft.timing === 'window' && (
        <label>
          {t('Usual end')}
          <TimeField value={draft.end} label="Usual end" onChange={v => set({ end: v })} />
        </label>
      )}

      <div className="wide">
        <label>{t('Places on site')}</label>
        <div className="place-editor">
          {draft.places.map(p => (
            <span className="place-chip" key={p.id}>
              {p.name}
              <button
                type="button"
                aria-label={`Remove ${p.name}`}
                onClick={() => set({ places: draft.places.filter(x => x.id !== p.id) })}
              >
                ×
              </button>
            </span>
          ))}
          <input
            value={place}
            placeholder={t('Add a hall…')}
            onChange={e => setPlace(e.target.value)}
            onKeyDown={e => {
              if (e.key === 'Enter') {
                e.preventDefault()
                addPlace()
              }
            }}
          />
          <button type="button" className="button button-secondary button-small" onClick={addPlace}>
            {t('Add')}
          </button>
        </div>
        <p className="field-hint">
          {t(
            'Halls the client orders separately — Slego, Conakryweg. None means the site is ordered as a whole.',
          )}
        </p>
      </div>

      <div className="wide">
        <label>{t('Requirements')}</label>
        <div className="requirement-editor">
          {draft.requirements.map(requirement => (
            <div className="requirement-editor-row" key={requirement.id}>
              <select
                aria-label={t('Requirement type')}
                value={requirement.kind}
                onChange={event =>
                  set({
                    requirements: draft.requirements.map(item =>
                      item.id === requirement.id
                        ? { ...item, kind: event.target.value as RequirementKind }
                        : item,
                    ),
                  })
                }
              >
                <option value="skill">{t('Skill')}</option>
                <option value="language">{t('Language')}</option>
                <option value="document">{t('Document')}</option>
                <option value="transport">{t('Transport')}</option>
                <option value="availability">{t('Availability')}</option>
              </select>
              <input
                aria-label={t('Requirement')}
                value={requirement.label}
                onChange={event =>
                  set({
                    requirements: draft.requirements.map(item =>
                      item.id === requirement.id ? { ...item, label: event.target.value } : item,
                    ),
                  })
                }
              />
              <label className="checkbox-field">
                <input
                  type="checkbox"
                  checked={requirement.required}
                  onChange={event =>
                    set({
                      requirements: draft.requirements.map(item =>
                        item.id === requirement.id ? { ...item, required: event.target.checked } : item,
                      ),
                    })
                  }
                />{' '}
                {t('Required')}
              </label>
              <button
                type="button"
                className="button button-secondary button-small"
                onClick={() =>
                  set({
                    requirements: draft.requirements.filter(item => item.id !== requirement.id),
                  })
                }
              >
                {t('Remove')}
              </button>
            </div>
          ))}
          <div className="requirement-editor-row">
            <select
              aria-label={t('New requirement type')}
              value={requirementKind}
              onChange={event => setRequirementKind(event.target.value as RequirementKind)}
            >
              <option value="skill">{t('Skill')}</option>
              <option value="language">{t('Language')}</option>
              <option value="document">{t('Document')}</option>
              <option value="transport">{t('Transport')}</option>
              <option value="availability">{t('Availability')}</option>
            </select>
            <input
              aria-label={t('New requirement')}
              placeholder={t('e.g. Warehouse experience')}
              value={requirementLabel}
              onChange={event => setRequirementLabel(event.target.value)}
              onKeyDown={event => {
                if (event.key === 'Enter' && requirementLabel.trim()) {
                  event.preventDefault()
                  set({
                    requirements: [
                      ...draft.requirements,
                      {
                        id: `req-${crypto.randomUUID()}`,
                        kind: requirementKind,
                        label: requirementLabel.trim(),
                        required: true,
                      },
                    ],
                  })
                  setRequirementLabel('')
                }
              }}
            />
            <button
              type="button"
              className="button button-secondary button-small"
              disabled={!requirementLabel.trim()}
              onClick={() => {
                set({
                  requirements: [
                    ...draft.requirements,
                    {
                      id: `req-${crypto.randomUUID()}`,
                      kind: requirementKind,
                      label: requirementLabel.trim(),
                      required: true,
                    },
                  ],
                })
                setRequirementLabel('')
              }}
            >
              {t('Add requirement')}
            </button>
          </div>
        </div>
        <p className="field-hint">
          {t(
            'Required items block a candidate when their profile confirms a mismatch. Unrecorded qualifications remain a warning to verify.',
          )}
        </p>
      </div>

      <label className="checkbox-field">
        <input
          type="checkbox"
          checked={draft.requiresAvailableList}
          onChange={e => set({ requiresAvailableList: e.target.checked })}
        />{' '}
        {t('Client requires a list of available people')}
      </label>
      <label className="checkbox-field">
        <input type="checkbox" checked={draft.carOnly} onChange={e => set({ carOnly: e.target.checked })} />{' '}
        {t('Reachable by car only — people without one cannot be placed here')}
      </label>
      <label className="checkbox-field">
        <input
          type="checkbox"
          checked={draft.trackHoursManually}
          onChange={e => set({ trackHoursManually: e.target.checked })}
        />{' '}
        {t('Track hours manually')}
      </label>
      {draft.trackHoursManually && (
        <>
          <label>
            {t('Default hours per day')}
            <input
              type="number"
              min={0}
              max={24}
              step={0.25}
              value={draft.defaultHours}
              placeholder="8"
              onChange={e => set({ defaultHours: e.target.value })}
            />
            <small className="field-hint">
              {t('Everyone on the schedule that day starts with this. Clearing a cell puts it back.')}
            </small>
          </label>
          <label>
            {t('Project code')}
            <input
              value={draft.projectCode}
              placeholder={t('ALWct')}
              onChange={e => set({ projectCode: e.target.value })}
            />
            <small className="field-hint">{t("The client's own code, printed in their weekly sheet.")}</small>
          </label>
        </>
      )}
    </div>
  )
}
