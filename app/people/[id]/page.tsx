import { notFound } from 'next/navigation'
import { PersonView } from '@/components/workforce-views'
import { WorkforceDataProvider } from '@/components/workforce-data-context'
import { requireSession } from '@/lib/auth/guard'
import { getPageWorkforceData } from '@/lib/db/page-data'

export const dynamic = 'force-dynamic'

export default async function Page({ params }: { params: Promise<{ id: string }> }) {
  await requireSession()
  const { id } = await params
  if (!/^[1-9]\d*$/.test(id)) notFound()
  const workerId = Number(id)
  if (!Number.isSafeInteger(workerId) || workerId > 2_147_483_647) notFound()
  const data = await getPageWorkforceData()
  const person = data.workers.find(worker => worker.id === String(workerId))
  if (!person) notFound()
  return <WorkforceDataProvider data={data}><PersonView id={person.id} /></WorkforceDataProvider>
}
