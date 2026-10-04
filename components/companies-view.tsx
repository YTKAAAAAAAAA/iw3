'use client'

import { AppShell, PageHeading, Panel, useExit } from '@/components/app-shell'
import { useWorkforceData } from '@/components/workforce-data-context'
import type { Company } from '@/lib/types'
import { ArrowUpRight, Plus, X } from 'lucide-react'
import { useRouter } from 'next/navigation'
import { useState } from 'react'

export function CompaniesView() {
  const router = useRouter()
  const { companies, workers } = useWorkforceData()
  const [list, setList] = useState<Company[]>(companies)
  const [editing, setEditing] = useState<Company | 'new' | null>(null)
  const [error, setError] = useState('')
  const [saving, setSaving] = useState(false)
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
              Add company
            </button>
          }
        />
        <Panel className="full-panel">
          <div className="company-grid">
            {list.map(c => (
              <div className="company-card" key={c.id}>
                <div className="company-logo">{c.logoUrl ? <img src={c.logoUrl} alt="" /> : c.name[0]}</div>
                <div>
                  <h2>{c.name}</h2>
                  <p>
                    {c.contactPerson} · {c.phone}
                  </p>
                  <strong>
                    {workers.filter(w => w.status === 'active' && w.companyAccess.includes(c.id)).length}{' '}
                    people with access
                  </strong>
                </div>
                <button className="icon-button" aria-label={`Edit ${c.name}`} onClick={() => open(c)}>
                  <ArrowUpRight />
                </button>
              </div>
            ))}
          </div>
        </Panel>
        {editing && (
          <div className={`dialog-backdrop ${closing ? 'closing' : ''}`} onClick={dismiss}>
            <div className="dialog" onClick={e => e.stopPropagation()}>
              <div className="panel-header">
                <h2>{editing === 'new' ? 'Add company' : 'Edit company'}</h2>
                <button className="icon-button" onClick={dismiss} aria-label="Close">
                  <X />
                </button>
              </div>
              <label>
                Company name
                <input
                  placeholder="Company name"
                  value={draft.name}
                  onChange={e => setDraft({ ...draft, name: e.target.value })}
                />
              </label>
              <label>
                Contact person
                <input
                  placeholder="Name"
                  value={draft.contactPerson}
                  onChange={e => setDraft({ ...draft, contactPerson: e.target.value })}
                />
              </label>
              <label>
                Phone
                <input
                  placeholder="+31"
                  value={draft.phone}
                  onChange={e => setDraft({ ...draft, phone: e.target.value })}
                />
              </label>
              <label>
                Notes
                <textarea value={draft.notes} onChange={e => setDraft({ ...draft, notes: e.target.value })} />
              </label>
              <p className="field-hint">Logo uploads are not available yet.</p>
              {error && (
                <p className="dialog-note" role="alert">
                  {error}
                </p>
              )}
              <div className="form-footer">
                <button className="button button-secondary" disabled={saving} onClick={dismiss}>
                  Cancel
                </button>
                <button className="button button-primary" disabled={saving} onClick={save}>
                  {saving ? 'Saving…' : 'Save company'}
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    </AppShell>
  )
}
