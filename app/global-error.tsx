'use client'

import './globals.css'

/* Shown only when the root layout itself fails, so nothing from it is
   available: no language setting and no theme class. The text is therefore
   given in both languages and the colours follow the system theme. */
export default function GlobalError({
  error,
  retry,
}: {
  error: Error & { digest?: string }
  retry: () => void
}) {
  return (
    <html lang="en">
      <body className="antialiased">
        <title>International@Work · Dispatcher</title>
        <main className="auth-page">
          <section className="auth-card status-card" aria-labelledby="global-error-title">
            <h1 id="global-error-title">Something went wrong</h1>
            <p>The dispatcher could not start this page. Try again in a moment.</p>
            <p lang="nl">Er ging iets mis. Probeer het zo opnieuw.</p>
            {error.digest && (
              <p className="field-hint">
                Reference: <code>{error.digest}</code>
              </p>
            )}
            <div className="button-row">
              <button type="button" className="button button-primary" onClick={retry}>
                Try again · Opnieuw
              </button>
            </div>
          </section>
        </main>
      </body>
    </html>
  )
}
