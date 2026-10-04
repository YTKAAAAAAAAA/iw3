'use client'

import { useEffect } from 'react'
import { StatusPage } from '@/components/status-page'

export default function Error({ error, retry }: { error: Error & { digest?: string }; retry: () => void }) {
  useEffect(() => {
    console.error(error)
  }, [error])

  return (
    <StatusPage
      title="Something went wrong"
      description="This page could not be shown. Try again, or return to the overview. Your saved data is not affected."
      reference={error.digest}
      onRetry={retry}
    />
  )
}
