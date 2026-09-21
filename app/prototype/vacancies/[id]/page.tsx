import { PrototypeVacancy } from '@/components/prototype-vacancy'

export default async function Page({ params }: { params: Promise<{ id: string }> }) {
  await params
  return <PrototypeVacancy />
}
