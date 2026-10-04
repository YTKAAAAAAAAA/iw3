import { CompaniesView } from '@/components/companies-view'
import { WorkforceDataProvider } from '@/components/workforce-data-context'
import { requireSession } from '@/lib/auth/guard'
import { getPageWorkforceData } from '@/lib/db/page-data'

export const dynamic = 'force-dynamic'

export default async function Page() {
  await requireSession()
  const data = await getPageWorkforceData()
  return <WorkforceDataProvider data={data}><CompaniesView /></WorkforceDataProvider>
}
