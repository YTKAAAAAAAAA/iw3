'use client'

import { useCallback, useEffect, useRef, useState } from 'react'
import { ImagePlus, LoaderCircle, Trash2 } from 'lucide-react'

type WorkdayPhoto = { id: string; content_type: string; byte_size: number; created_at: string }

function responseError(value: unknown, fallback: string) {
  if (typeof value === 'object' && value !== null && 'error' in value
    && typeof value.error === 'string') return value.error
  return fallback
}

export function WorkdayReport({ vacancyId, date }: { vacancyId: string; date: string }) {
  const [open, setOpen] = useState(false)
  const [photos, setPhotos] = useState<WorkdayPhoto[]>([])
  const [loading, setLoading] = useState(false)
  const [uploading, setUploading] = useState(false)
  const [error, setError] = useState('')
  const inputRef = useRef<HTMLInputElement>(null)
  const endpoint = `/api/vacancies/${encodeURIComponent(vacancyId)}/reports`

  const loadPhotos = useCallback(async (signal?: AbortSignal) => {
    setLoading(true)
    setError('')
    try {
      const response = await fetch(`${endpoint}?date=${encodeURIComponent(date)}`, { signal, cache: 'no-store' })
      const result: unknown = await response.json()
      if (!response.ok) throw new Error(responseError(result, 'Could not load workday photos.'))
      if (typeof result !== 'object' || result === null || !('photos' in result)
        || !Array.isArray(result.photos)
        || !result.photos.every(photo => typeof photo === 'object' && photo !== null
          && 'id' in photo && typeof photo.id === 'string'
          && 'content_type' in photo && typeof photo.content_type === 'string'
          && 'byte_size' in photo && typeof photo.byte_size === 'number'
          && 'created_at' in photo && typeof photo.created_at === 'string')) {
        throw new Error('The server returned an invalid photo list.')
      }
      setPhotos(result.photos)
    } catch (cause) {
      if (cause instanceof DOMException && cause.name === 'AbortError') return
      setError(cause instanceof Error ? cause.message : 'Could not load workday photos.')
    } finally {
      setLoading(false)
    }
  }, [date, endpoint])

  useEffect(() => {
    if (!open) return
    const controller = new AbortController()
    void loadPhotos(controller.signal)
    return () => controller.abort()
  }, [loadPhotos, open])

  const upload = async (files: File[]) => {
    setUploading(true)
    setError('')
    try {
      for (const file of files) {
        const form = new FormData()
        form.set('date', date)
        form.set('photo', file)
        const response = await fetch(endpoint, { method: 'POST', body: form })
        const result: unknown = await response.json()
        if (!response.ok) throw new Error(responseError(result, `Could not upload ${file.name}.`))
      }
      await loadPhotos()
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'Could not upload the photos.')
    } finally {
      setUploading(false)
      if (inputRef.current) inputRef.current.value = ''
    }
  }

  const removePhoto = async (photoId: string) => {
    setError('')
    try {
      const response = await fetch(`${endpoint}/${encodeURIComponent(photoId)}`, { method: 'DELETE' })
      if (!response.ok) {
        const result: unknown = await response.json()
        throw new Error(responseError(result, 'Could not delete the photo.'))
      }
      setPhotos(current => current.filter(photo => photo.id !== photoId))
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'Could not delete the photo.')
    }
  }

  return (
    <section className="workday-report" aria-label={`Workday report for ${date}`}>
      <div className="workday-report-head">
        <div>
          <strong>Daily work report</strong>
          <span>{photos.length ? `${photos.length} ${photos.length === 1 ? 'photo' : 'photos'}` : 'Photos stay out of the shared schedule'}</span>
        </div>
        <button className="button button-secondary button-small" type="button" aria-expanded={open}
          onClick={() => setOpen(value => !value)}>
          <ImagePlus />{open ? 'Close report' : 'Add photos'}
        </button>
      </div>
      {open && <div className="workday-report-body">
        <p>Attach photos from this workday. They are private and do not appear in Share view.</p>
        <input ref={inputRef} className="workday-photo-input" type="file"
          accept="image/jpeg,image/png,image/webp" capture="environment" multiple
          aria-label={`Choose photos for ${date}`} disabled={uploading}
          onChange={event => { void upload(Array.from(event.currentTarget.files ?? [])) }} />
        {loading && <p className="workday-report-status"><LoaderCircle className="spin" />Loading photos…</p>}
        {error && <p className="workday-report-error" role="alert">{error}</p>}
        {!loading && photos.length > 0 && <div className="workday-photo-grid">
          {photos.map(photo => <figure key={photo.id} className="workday-photo">
            <a href={`${endpoint}/${encodeURIComponent(photo.id)}`} target="_blank" rel="noreferrer">
              <img src={`${endpoint}/${encodeURIComponent(photo.id)}`} alt={`Workday photo from ${date}`} loading="lazy" />
            </a>
            <figcaption>
              <span>{new Date(photo.created_at).toLocaleTimeString(undefined, { hour: '2-digit', minute: '2-digit' })}</span>
              <button className="icon-button" type="button" aria-label="Delete photo" disabled={uploading}
                onClick={() => void removePhoto(photo.id)}><Trash2 /></button>
            </figcaption>
          </figure>)}
        </div>}
        {uploading && <p className="workday-report-status"><LoaderCircle className="spin" />Saving photos…</p>}
      </div>}
    </section>
  )
}
