'use client'

import { useLanguage } from '@/lib/i18n'
import { AppShell, PageHeading, Panel, useExit } from '@/components/app-shell'
import { useWorkforceData } from '@/components/workforce-data-context'
import type { Company } from '@/lib/types'
import { formatDate, joinDetails } from '@/lib/types'
import { ArrowUpRight, Plus, X } from 'lucide-react'
import { useRouter } from 'next/navigation'
import { useRef, useState } from 'react'
import { useConfirm } from '@/components/confirm-dialog'

const errorOf = (result: unknown, fallback: string) =>
  typeof result === 'object' && result !== null && 'error' in result && typeof result.error === 'string'
    ? result.error
    : fallback

const companyOf = (result: unknown): Company => {
  if (
    typeof result !== 'object' ||
    result === null ||
    !('company' in result) ||
    typeof result.company !== 'object' ||
    result.company === null ||
    !('id' in result.company) ||
    typeof result.company.id !== 'string'
  )
    throw new Error('The server returned an invalid company response.')
  return result.company as Company
}

export function CompaniesView() {
  const { t } = useLanguage()
  const router = useRouter()
  const { companies, workers, vacancies } = useWorkforceData()
  const [list, setList] = useState<Company[]>(companies)
  const [editing, setEditing] = useState<Company | 'new' | null>(null)
  const [error, setError] = useState('')
  const [saving, setSaving] = useState(false)
  const [restoring, setRestoring] = useState<string | null>(null)
  const [logoSaving, setLogoSaving] = useState(false)
  const { confirm, confirmElement } = useConfirm()
  const logoInput = useRef<HTMLInputElement | null>(null)
  const [restoreError, setRestoreError] = useState('')
  const peopleWithAccess = (companyId: string) =>
    workers.filter(w => w.status === 'active' && w.companyAccess.includes(companyId)).length
  const visible = list.filter(c => !c.archivedAt)
  const archived = list.filter(c => c.archivedAt)
  const [draft, setDraft] = useState({ name: '', contactPerson: '', phone: '', notes: '' })
  const { closing, close: dismiss } = useExit(() => setEditing(null))
  const open = (c: Company | 'new') => {
    setError('')
    setEditing(c)
    setDraft(
      c === 'new'
        ? { name: '', contactPerson: '', phone: '', notes: '' }
        : { name: c.name, contactPerson: c.contactPerson ?? '', phone: c.phone ?? '', notes: c.notes ?? '' },
    )
  }
  const save = async () => {
    if (!editing) return
    const name = draft.name.trim()
    if (!name) {
      setError('A company needs a name.')
      return
    }
    const clash = list.some(
      c => c.name.trim().toLowerCase() === name.toLowerCase() && (editing === 'new' || c.id !== editing?.id),
    )
    if (clash) {
      setError(`A company called "${name}" already exists.`)
      return
    }
    setSaving(true)
    setError('')
    try {
      const details = {
        name,
        contactPerson: draft.contactPerson.trim() || null,
        phone: draft.phone.trim() || null,
        notes: draft.notes.trim() || null,
      }
      if (editing === 'new') {
        const response = await fetch('/api/companies', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(details),
        })
        const result: unknown = await response.json()
        if (!response.ok) {
          setError(
            typeof result === 'object' &&
              result !== null &&
              'error' in result &&
              typeof result.error === 'string'
              ? result.error
              : 'Could not save the company.',
          )
          return
        }
        if (
          typeof result !== 'object' ||
          result === null ||
          !('company' in result) ||
          typeof result.company !== 'object' ||
          result.company === null ||
          !('id' in result.company) ||
          typeof result.company.id !== 'string'
        )
          throw new Error('The server returned an invalid company response.')
        const company = result.company as Company
        setList(cur => [...cur, company])
        router.refresh()
      } else {
        const response = await fetch(`/api/companies/${encodeURIComponent(editing.id)}`, {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(details),
        })
        const result: unknown = await response.json()
        if (!response.ok) {
          setError(
            typeof result === 'object' &&
              result !== null &&
              'error' in result &&
              typeof result.error === 'string'
              ? result.error
              : 'Could not save the company.',
          )
          return
        }
        if (
          typeof result !== 'object' ||
          result === null ||
          !('company' in result) ||
          typeof result.company !== 'object' ||
          result.company === null ||
          !('id' in result.company) ||
          typeof result.company.id !== 'string'
        )
          throw new Error('The server returned an invalid company response.')
        setList(cur => cur.map(c => (c.id === editing.id ? (result.company as Company) : c)))
        router.refresh()
      }
      setEditing(null)
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'Could not save the company.')
    } finally {
      setSaving(false)
    }
  }
  /* Archive, not delete: the company's vacancies hold shifts and hours that
     reports still need. The server detaches every worker and archives the
     open vacancies in one transaction. */
  const archive = async () => {
    if (!editing || editing === 'new') return
    const company = editing
    const openVacancies = vacancies.filter(v => v.companyId === company.id && !v.archivedAt).length
    if (
      !(await confirm(
        t(
          'Archive {name}? {people} people lose access and {vacancies} open vacancies are archived. Shifts and hours stay in history, and the company can be restored.',
          { name: company.name, people: peopleWithAccess(company.id), vacancies: openVacancies },
        ),
        { confirmLabel: 'Archive company' },
      ))
    )
      return
    setSaving(true)
    setError('')
    try {
      const response = await fetch(`/api/companies/${encodeURIComponent(company.id)}/archive`, { method: 'POST' })
      const result: unknown = await response.json()
      if (!response.ok) {
        setError(errorOf(result, 'Could not archive the company.'))
        return
      }
      const updated = companyOf(result)
      setList(cur => cur.map(c => (c.id === company.id ? updated : c)))
      router.refresh()
      setEditing(null)
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'Could not archive the company.')
    } finally {
      setSaving(false)
    }
  }
  /* The logo is saved the moment a file is picked, apart from the text fields:
     an upload is its own request, and a half-typed name should not block it. */
  const changeLogo = async (file: File | null) => {
    if (!editing || editing === 'new') return
    const company = editing
    setLogoSaving(true)
    setError('')
    try {
      let response: Response
      if (file) {
        const form = new FormData()
        form.append('logo', file)
        response = await fetch(`/api/companies/${encodeURIComponent(company.id)}/logo`, { method: 'PUT', body: form })
      } else {
        response = await fetch(`/api/companies/${encodeURIComponent(company.id)}/logo`, { method: 'DELETE' })
      }
      const result: unknown = await response.json()
      if (!response.ok) {
        setError(errorOf(result, 'Could not save the logo.'))
        return
      }
      const logoUrl =
        typeof result === 'object' && result !== null && 'logoUrl' in result && typeof result.logoUrl === 'string'
          ? result.logoUrl
          : null
      setList(cur => cur.map(c => (c.id === company.id ? { ...c, logoUrl } : c)))
      router.refresh()
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'Could not save the logo.')
    } finally {
      setLogoSaving(false)
      if (logoInput.current) logoInput.current.value = ''
    }
  }
  const editingLogo = editing && editing !== 'new' ? list.find(c => c.id === editing.id)?.logoUrl ?? null : null
  const restore = async (company: Company) => {
    setRestoring(company.id)
    setRestoreError('')
    try {
      const response = await fetch(`/api/companies/${encodeURIComponent(company.id)}/restore`, { method: 'POST' })
      const result: unknown = await response.json()
      if (!response.ok) {
        setRestoreError(errorOf(result, 'Could not restore the company.'))
        return
      }
      const updated = companyOf(result)
      setList(cur => cur.map(c => (c.id === company.id ? updated : c)))
      router.refresh()
    } catch (cause) {
      setRestoreError(cause instanceof Error ? cause.message : 'Could not restore the company.')
    } finally {
      setRestoring(null)
    }
  }
  return (
    <AppShell>
      <div className="content-inner">
        <PageHeading
          eyebrow="Workspace directory"
          title="Companies"
          description="Client contacts and access coverage."
          action={
            <button className="button button-primary" onClick={() => open('new')}>
              <Plus />
              {t('Add company')}
            </button>
          }
        />
        <Panel className="full-panel">
          <div className="company-grid">
            {visible.map(c => (
              <div className="company-card" key={c.id}>
                <div className="company-logo">{c.logoUrl ? <img src={c.logoUrl} alt="" /> : c.name[0]}</div>
                <div>
                  <h2>{c.name}</h2>
                  <p>{joinDetails(c.contactPerson, c.phone)}</p>
                  <strong>
                    {peopleWithAccess(c.id) === 1
                      ? t('1 person with access')
                      : t('{count} people with access', { count: peopleWithAccess(c.id) })}
                  </strong>
                </div>
                <button className="icon-button" aria-label={`Edit ${c.name}`} onClick={() => open(c)}>
                  <ArrowUpRight />
                </button>
              </div>
            ))}
          </div>
        </Panel>
        {archived.length > 0 && (
          <Panel className="full-panel">
            <div className="panel-header">
              <div>
                <h2>{t('Archived companies')}</h2>
                <p>{t('Hidden from every list. Their vacancies, shifts and hours stay in history.')}</p>
              </div>
            </div>
            {restoreError && (
              <p className="dialog-note" role="alert">
                {t(restoreError)}
              </p>
            )}
            <div className="company-grid">
              {archived.map(c => (
                <div className="company-card" key={c.id}>
                  <div className="company-logo">{c.logoUrl ? <img src={c.logoUrl} alt="" /> : c.name[0]}</div>
                  <div>
                    <h2>{c.name}</h2>
                    <p>{t('Archived {date}', { date: formatDate(c.archivedAt) })}</p>
                  </div>
                  <button
                    className="button button-secondary button-small"
                    disabled={restoring !== null}
                    onClick={() => void restore(c)}
                  >
                    {restoring === c.id ? t('Saving…') : t('Restore')}
                  </button>
                </div>
              ))}
            </div>
          </Panel>
        )}
        {editing && (
          <div className={`dialog-backdrop ${closing ? 'closing' : ''}`} onClick={dismiss}>
            <div className="dialog" onClick={e => e.stopPropagation()}>
              <div className="panel-header">
                <h2>{editing === 'new' ? t('Add company') : t('Edit company')}</h2>
                <button className="icon-button" onClick={dismiss} aria-label={t('Close')}>
                  <X />
                </button>
              </div>
              <label>
                {t('Company name')}
                <input
                  placeholder={t('Company name')}
                  value={draft.name}
                  onChange={e => setDraft({ ...draft, name: e.target.value })}
                />
              </label>
              <label>
                {t('Contact person')}
                <input
                  placeholder={t('Name')}
                  value={draft.contactPerson}
                  onChange={e => setDraft({ ...draft, contactPerson: e.target.value })}
                />
              </label>
              <label>
                {t('Phone')}
                <input
                  placeholder="+31"
                  value={draft.phone}
                  onChange={e => setDraft({ ...draft, phone: e.target.value })}
                />
              </label>
              <label>
                {t('Notes')}
                <textarea value={draft.notes} onChange={e => setDraft({ ...draft, notes: e.target.value })} />
              </label>
              {editing === 'new' ? (
                <p className="field-hint">{t('Save the company first, then add its logo.')}</p>
              ) : (
                <div className="company-logo-field">
                  <div className="company-logo">
                    {editingLogo ? <img src={editingLogo} alt="" /> : editing.name[0]}
                  </div>
                  <input
                    ref={logoInput}
                    type="file"
                    accept="image/jpeg,image/png,image/webp"
                    hidden
                    onChange={e => void changeLogo(e.target.files?.[0] ?? null)}
                  />
                  <button
                    className="button button-secondary button-small"
                    disabled={saving || logoSaving}
                    onClick={() => logoInput.current?.click()}
                  >
                    {logoSaving ? t('Saving…') : editingLogo ? t('Replace logo') : t('Upload logo')}
                  </button>
                  {editingLogo && (
                    <button
                      className="button button-secondary button-small"
                      disabled={saving || logoSaving}
                      onClick={() => void changeLogo(null)}
                    >
                      {t('Remove logo')}
                    </button>
                  )}
                </div>
              )}
              {error && (
                <p className="dialog-note" role="alert">
                  {error}
                </p>
              )}
              <div className="form-footer">
                {editing !== 'new' && (
                  <button className="button button-secondary" disabled={saving} onClick={() => void archive()}>
                    {t('Archive company')}
                  </button>
                )}
                <button className="button button-secondary" disabled={saving} onClick={dismiss}>
                  {t('Cancel')}
                </button>
                <button className="button button-primary" disabled={saving} onClick={save}>
                  {saving ? t('Saving…') : t('Save company')}
                </button>
              </div>
            </div>
          </div>
        )}
        {confirmElement}
      </div>
    </AppShell>
  )
}
