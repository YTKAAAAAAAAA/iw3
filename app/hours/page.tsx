import { HoursView } from '@/components/hours/hours-view'
import { WorkforceDataProvider } from '@/components/workforce-data-context'
import { requireSession } from '@/lib/auth/guard'
import { getPageWorkforceData } from '@/lib/db/page-data'

export const dynamic = 'force-dynamic'

export default async function Page() {
  await requireSession()
  const data = await getPageWorkforceData({ include: ['schedule', 'leaves', 'hours'] })
  return <WorkforceDataProvider data={data}><HoursView /></WorkforceDataProvider>
}
