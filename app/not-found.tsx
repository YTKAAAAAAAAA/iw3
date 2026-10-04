import { StatusPage } from '@/components/status-page'

export default function NotFound() {
  return (
    <StatusPage
      code="404"
      title="Page not found"
      description="This person, vacancy or page does not exist, or it was removed."
    />
  )
}
