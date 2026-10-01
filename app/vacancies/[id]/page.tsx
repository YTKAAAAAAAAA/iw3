import { notFound } from 'next/navigation'
import { VacancyView } from '@/components/workforce-views'
import { WorkforceDataProvider } from '@/components/workforce-data-context'
import { requireSession } from '@/lib/auth/guard'
import { getPageWorkforceData } from '@/lib/db/page-data'

export const dynamic = 'force-dynamic'

export default async function Page({ params }: { params: Promise<{ id: string }> }) {
  await requireSession()
  const { id } = await params
  const data = await getPageWorkforceData()
  const vacancy = data.vacancies.find(item => id === item.id || id === item.id.replace('v-', ''))
  if (!vacancy) notFound()
  return <WorkforceDataProvider data={data}><VacancyView id={vacancy.id} /></WorkforceDataProvider>
}
