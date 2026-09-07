import { VacancyView } from '@/components/workforce-views'
export default async function Page({ params }:{params:Promise<{id:string}>}){ const {id}=await params; return <VacancyView id={id}/> }
