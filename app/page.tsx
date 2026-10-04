import { requireSession } from '@/lib/auth/guard'
import { Overview } from '@/components/overview'
import { WorkforceDataProvider } from '@/components/workforce-data-context'
import { getPageWorkforceData } from '@/lib/db/page-data'

export const dynamic = 'force-dynamic'

export default async function Page() {
  await requireSession()
  const data = await getPageWorkforceData({ include: ['schedule', 'leaves'] })
  return <WorkforceDataProvider data={data}><Overview /></WorkforceDataProvider>
}
