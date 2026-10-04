import { Analytics } from '@vercel/analytics/next'
import type { Metadata, Viewport } from 'next'
import { headers } from 'next/headers'
import { LanguageProvider } from '@/lib/i18n'
import { TodayProvider } from '@/lib/today'
import { todayInAmsterdam } from '@/lib/types'
import './globals.css'

export const metadata: Metadata = {
  title: 'International@Work · Dispatcher',
  description: 'Company-wide scheduling and workforce operations across International@Work vacancies.',
  icons: { icon: [{ url: '/icon.svg', type: 'image/svg+xml' }] },
}

export const viewport: Viewport = {
  colorScheme: 'light dark',
  themeColor: [
    { media: '(prefers-color-scheme: light)', color: 'white' },
    { media: '(prefers-color-scheme: dark)', color: 'black' },
  ],
}

export default async function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode
}>) {
  const nonce = (await headers()).get('x-nonce') ?? undefined
  return (
    <html lang="en" suppressHydrationWarning>
      <head>
        {/* The theme is painted before the first frame. React cannot do this:
            the server has no way of knowing what this browser chose last
            time, so a themed page would arrive dark and flip to light after
            hydration. Four lines of blocking script cost less than that
            flash. The class name matches the one AppShell keeps in sync. */}
        <script
          nonce={nonce}
          dangerouslySetInnerHTML={{
            __html: `try{document.documentElement.classList.add(localStorage.getItem('iaw-theme')==='light'?'theme-light':'theme-dark')}catch(e){document.documentElement.classList.add('theme-dark')}`,
          }}
        />
      </head>
      <body className="antialiased">
        <LanguageProvider>
          <TodayProvider initial={todayInAmsterdam()}>{children}</TodayProvider>
        </LanguageProvider>
        {/* Vercel serves the analytics script; a self-hosted server would answer 404. */}
        {process.env.VERCEL === '1' && <Analytics />}
      </body>
    </html>
  )
}
