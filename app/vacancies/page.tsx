import { VacanciesView } from '@/components/workforce-views'
import { WorkforceDataProvider } from '@/components/workforce-data-context'
import { requireSession } from '@/lib/auth/guard'
import { getWarehouseAppData } from '@/lib/db/workforce'

export const dynamic = 'force-dynamic'

export default async function Page() {
  await requireSession()
  const data = await getWarehouseAppData()
  return <WorkforceDataProvider data={data}><VacanciesView /></WorkforceDataProvider>
}
