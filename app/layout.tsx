import { Analytics } from '@vercel/analytics/next'
import type { Metadata, Viewport } from 'next'
import './globals.css'

export const metadata: Metadata = {
  title: 'International@Work · Workforce operations',
  description: 'A clear daily workspace for people, vacancies, hours and office tasks.',
  generator: 'v0.app',
  /* One SVG for every size. The PNGs that used to sit here came with the v0
     export and carried v0's own logo. */
  icons: { icon: [{ url: '/icon.svg', type: 'image/svg+xml' }] },
}

export const viewport: Viewport = {
  colorScheme: 'light dark',
  themeColor: [
    { media: '(prefers-color-scheme: light)', color: 'white' },
    { media: '(prefers-color-scheme: dark)', color: 'black' },
  ],
}

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode
}>) {
  return (
    <html lang="en" suppressHydrationWarning>
      <head>
        {/* The theme is painted before the first frame. React cannot do this:
            the server has no way of knowing what this browser chose last
            time, so a themed page would arrive dark and flip to light after
            hydration. Four lines of blocking script cost less than that
            flash. The class name matches the one AppShell keeps in sync. */}
        <script dangerouslySetInnerHTML={{ __html: `try{document.documentElement.classList.add(localStorage.getItem('iaw-theme')==='light'?'theme-light':'theme-dark')}catch(e){document.documentElement.classList.add('theme-dark')}` }} />
      </head>
      <body className="antialiased">
        {children}
        {process.env.NODE_ENV === 'production' && <Analytics />}
      </body>
    </html>
  )
}
