import { Suspense } from 'react'
import { PeopleView } from '@/components/people/people-view'
import { WorkforceDataProvider } from '@/components/workforce-data-context'
import { requireSession } from '@/lib/auth/guard'
import { getPageWorkforceData } from '@/lib/db/page-data'

export const dynamic = 'force-dynamic'

export default async function Page({ searchParams }: { searchParams: Promise<{ status?: string }> }) {
  await requireSession()
  const { status } = await searchParams
  // Only the dismissed list shows worked hours.
  const data = await getPageWorkforceData({
    include: status === 'dismissed' ? ['schedule', 'leaves', 'hours'] : ['schedule', 'leaves'],
  })
  return <WorkforceDataProvider data={data}><Suspense><PeopleView /></Suspense></WorkforceDataProvider>
}
