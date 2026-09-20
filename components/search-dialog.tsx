'use client'
import Link from 'next/link'
import { Fragment, useEffect, useMemo, useRef, useState } from 'react'
import { Briefcase, Building2, Search, Users, X } from 'lucide-react'
import { companies, vacancies, workers } from '@/lib/mock-data'

/* Highlights the first hit of `query` inside `text` — same idea as a
   browser's own find-in-page, so it's obvious which word actually matched
   rather than making someone re-read every field to spot it. Only the
   first occurrence: a result card is a few words, not a paragraph, and
   marking every repeat would be more noise than signal. */
function highlight(text: string, query: string) {
  const q = query.trim()
  if (!q) return text
  const at = text.toLowerCase().indexOf(q.toLowerCase())
  if (at === -1) return text
  return <Fragment>{text.slice(0, at)}<mark>{text.slice(at, at + q.length)}</mark>{text.slice(at + q.length)}</Fragment>
}

/* One flat list across three very different record shapes, so the result
   needs to say what it is at a glance — same icon-plate + tone the vacancy
   list already uses (`.vacancy-icon.icon-*`), paired with the section's own
   nav icon so "this is a person" reads the same way it does in the sidebar.
   No photo/initials circle here: workers don't carry one anywhere else in
   this app any more, and a search hit is not the place to reintroduce it. */
type Kind = 'person' | 'company' | 'vacancy'
type Hit = { id: string; kind: Kind; title: string; subtitle: string; href: string }
const KIND_ICON = { person: Users, company: Building2, vacancy: Briefcase } as const
const KIND_LABEL = { person: 'Person', company: 'Company', vacancy: 'Vacancy' } as const
const KIND_TONE = { person: 'blue', company: 'purple', vacancy: 'orange' } as const

export function SearchDialog({ open, onClose }: { open: boolean; onClose: () => void }) {
  const [query, setQuery] = useState('')
  const inputRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    if (!open) return
    setQuery('')
    /* Focus after the dialog has actually mounted/painted, not before. */
    const id = requestAnimationFrame(() => inputRef.current?.focus())
    return () => cancelAnimationFrame(id)
  }, [open])

  useEffect(() => {
    if (!open) return
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose() }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [open, onClose])

  const hits = useMemo<Hit[]>(() => {
    const q = query.trim().toLowerCase()
    if (!q) return []
    const people: Hit[] = workers
      .filter(w => w.status === 'active' && (w.fullName.toLowerCase().includes(q) || w.city?.toLowerCase().includes(q) || w.email.toLowerCase().includes(q)))
      .slice(0, 6)
      .map(w => ({ id: w.id, kind: 'person', title: w.fullName, subtitle: w.city || 'No city on file', href: `/people/${w.id}` }))
    const orgs: Hit[] = companies
      .filter(c => c.name.toLowerCase().includes(q) || c.contactPerson?.toLowerCase().includes(q))
      .slice(0, 6)
      .map(c => ({ id: c.id, kind: 'company', title: c.name, subtitle: c.contactPerson || 'No contact on file', href: '/companies' }))
    const jobs: Hit[] = vacancies
      .filter(v => v.title.toLowerCase().includes(q) || v.address.toLowerCase().includes(q))
      .slice(0, 6)
      .map(v => ({ id: v.id, kind: 'vacancy', title: v.title, subtitle: v.address, href: `/vacancies/${v.id}` }))
    return [...people, ...orgs, ...jobs]
  }, [query])

  if (!open) return null

  return (
    <div className="dialog-backdrop" onClick={onClose}>
      <div className="dialog dialog-wide search-dialog" onClick={e => e.stopPropagation()}>
        <div className="search-input-row">
          <Search />
          <input ref={inputRef} value={query} onChange={e => setQuery(e.target.value)}
            onKeyDown={e => { if (e.key === 'Enter' && hits[0]) onClose() }}
            placeholder="Search people, companies, vacancies…" aria-label="Search everything" />
          <button className="icon-button" onClick={onClose} aria-label="Close search"><X /></button>
        </div>
        {!query.trim() && <p className="search-empty">Start typing to search people, companies and vacancies.</p>}
        {query.trim() && !hits.length && <p className="search-empty">Nothing matches “{query}”.</p>}
        {hits.length > 0 && (
          <ul className="search-results">
            {hits.map(hit => {
              const Icon = KIND_ICON[hit.kind]
              return (
                <li key={`${hit.kind}-${hit.id}`}>
                  <Link href={hit.href} onClick={onClose} className="search-result-row">
                    <span className={`vacancy-icon icon-${KIND_TONE[hit.kind]}`}><Icon /></span>
                    <span className="search-result-text"><strong>{highlight(hit.title, query)}</strong><small>{highlight(hit.subtitle, query)}</small></span>
                    <span className={`badge badge-${KIND_TONE[hit.kind]}`}>{KIND_LABEL[hit.kind]}</span>
                  </Link>
                </li>
              )
            })}
          </ul>
        )}
      </div>
    </div>
  )
}
