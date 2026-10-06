'use client'

import { useEffect, useRef, useState } from 'react'
import { CalendarDays } from 'lucide-react'
import { useLanguage } from '@/lib/i18n'
import { formatDate, parseDate } from '@/lib/types'

/* ------------------------------------------------------------------
   A date typed and shown as dd.mm.yyyy.

   `<input type="date">` displays the date in the browser's own locale — on
   an English Mac that is 10/06/2026, month first — and a page cannot change
   that. Every date in this product is dd.mm.yyyy, so the field is text in
   that form; the calendar button still opens the browser's own date picker.
   An entry that is not a date, or falls outside min/max, is put back.
   ------------------------------------------------------------------ */
export function DateField({
  value,
  onChange,
  min,
  max,
  disabled = false,
  required = true,
  label,
  className = '',
}: {
  value: string
  onChange: (iso: string) => void
  min?: string
  max?: string
  disabled?: boolean
  /** When false, clearing the field is an answer (''), not a mistake. */
  required?: boolean
  label?: string
  className?: string
}) {
  const { t } = useLanguage()
  const shown = (iso: string) => (iso ? formatDate(iso) : '')
  const [text, setText] = useState(shown(value))
  const native = useRef<HTMLInputElement | null>(null)
  useEffect(() => {
    setText(value ? formatDate(value) : '')
  }, [value])

  const commit = () => {
    if (!text.trim()) {
      if (required) setText(shown(value))
      else if (value) onChange('')
      return
    }
    const iso = parseDate(text)
    if (!iso || (min && iso < min) || (max && iso > max)) {
      setText(shown(value))
      return
    }
    setText(formatDate(iso))
    if (iso !== value) onChange(iso)
  }

  return (
    <span className={`date-field ${disabled ? 'disabled' : ''} ${className}`}>
      <input
        type="text"
        inputMode="numeric"
        placeholder={t('dd.mm.yyyy')}
        aria-label={label}
        value={text}
        disabled={disabled}
        onChange={event => setText(event.target.value)}
        onBlur={commit}
        onKeyDown={event => {
          if (event.key === 'Enter') (event.target as HTMLInputElement).blur()
        }}
      />
      <button
        type="button"
        className="date-field-pick"
        disabled={disabled}
        aria-label={t('Pick a date')}
        onClick={() => {
          const input = native.current
          if (!input) return
          try {
            input.showPicker()
          } catch {
            input.focus()
            input.click()
          }
        }}
      >
        <CalendarDays />
      </button>
      <input
        ref={native}
        type="date"
        className="date-field-native"
        tabIndex={-1}
        aria-hidden="true"
        value={value}
        min={min}
        max={max}
        disabled={disabled}
        onChange={event => {
          if (event.target.value) onChange(event.target.value)
        }}
      />
    </span>
  )
}
