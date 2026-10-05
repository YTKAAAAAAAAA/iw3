import type { Company } from '@/lib/types'

/** The client's logo in a small circle beside a vacancy title, or its
 *  initial when no logo is uploaded. Decorative: the company name is always
 *  written out next to it. */
export function CompanyAvatar({ company }: { company: Company | undefined }) {
  if (!company) return null
  return (
    <span className="company-avatar" title={company.name} aria-hidden="true">
      {company.logoUrl ? <img src={company.logoUrl} alt="" /> : company.name[0]}
    </span>
  )
}
