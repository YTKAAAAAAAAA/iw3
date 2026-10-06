'use client'

import { useCallback, useState, type ReactNode } from 'react'
import { useLanguage } from '@/lib/i18n'

type Request = {
  message: string
  confirmLabel: string
  danger: boolean
  resolve: (ok: boolean) => void
}

/* ------------------------------------------------------------------
   A yes/no question asked inside the page.

   `window.confirm()` was used for every destructive step, and the Claude
   desktop app's built-in browser answers it with "no" in a millisecond
   without ever showing it — so archiving a company, dismissing a worker,
   ending an arrangement and removing a slot all silently did nothing there.
   An in-page dialog works in every browser.

   const { confirm, confirmElement } = useConfirm()
   if (!(await confirm(t('Remove …?'), { confirmLabel: 'Remove' }))) return
   …and render {confirmElement} outside any other dialog's markup.
   ------------------------------------------------------------------ */
export function useConfirm(): {
  confirm: (message: string, options?: { confirmLabel?: string; danger?: boolean }) => Promise<boolean>
  confirmElement: ReactNode
} {
  const { t } = useLanguage()
  const [request, setRequest] = useState<Request | null>(null)

  const confirm = useCallback(
    (message: string, options: { confirmLabel?: string; danger?: boolean } = {}) =>
      new Promise<boolean>(resolve =>
        setRequest({
          message,
          confirmLabel: options.confirmLabel ?? 'Confirm',
          danger: options.danger ?? true,
          resolve,
        }),
      ),
    [],
  )
  const answer = (ok: boolean) => {
    request?.resolve(ok)
    setRequest(null)
  }

  const confirmElement = request ? (
    <div className="dialog-backdrop confirm-backdrop" onClick={() => answer(false)}>
      <section
        className="dialog confirm-dialog"
        role="alertdialog"
        aria-modal="true"
        aria-describedby="confirm-message"
        onClick={event => event.stopPropagation()}
        onKeyDown={event => {
          if (event.key === 'Escape') answer(false)
        }}
      >
        <p id="confirm-message">{request.message}</p>
        <div className="form-footer">
          <button className="button button-secondary" autoFocus onClick={() => answer(false)}>
            {t('Cancel')}
          </button>
          <button
            className={`button ${request.danger ? 'button-danger' : 'button-primary'}`}
            onClick={() => answer(true)}
          >
            {t(request.confirmLabel)}
          </button>
        </div>
      </section>
    </div>
  ) : null

  return { confirm, confirmElement }
}
