'use client'

import { AppShell, PageHeading, Panel } from '@/components/app-shell'
import { AddManualWorkerDialog } from '@/components/people/add-worker-dialog'
import { DismissWorkerDialog } from '@/components/people/dismiss-worker-dialog'
import { DismissedList } from '@/components/people/dismissed-list'
import { PeopleTable } from '@/components/people/people-table'
import { useLanguage } from '@/lib/i18n'
import { Plus } from 'lucide-react'
import Link from 'next/link'
import { useSearchParams } from 'next/navigation'
import { useState } from 'react'

export function PeopleView() {
  const { t } = useLanguage()
  const dismissed = useSearchParams().get('status') === 'dismissed'
  const [adding, setAdding] = useState(false)
  const [dismissing, setDismissing] = useState(false)
  return (
    <AppShell>
      <div className="content-inner">
        <PageHeading
          eyebrow="Workforce directory"
          title={dismissed ? 'Dismissed people' : 'People'}
          description={
            dismissed
              ? 'Historical records remain available for reports and hours.'
              : 'Manage availability, company access and assignments.'
          }
          action={
            <Link
              className="button button-secondary"
              href={dismissed ? '/people' : '/people?status=dismissed'}
            >
              {t(dismissed ? 'Active people' : 'View dismissed')}
            </Link>
          }
        />
        {!dismissed && (
          <div className="manual-add-toolbar">
            <button className="button button-secondary" onClick={() => setDismissing(true)}>
              {t('Dismiss manually')}
            </button>
            <button className="button button-primary" onClick={() => setAdding(true)}>
              <Plus />
              {t('Add manually')}
            </button>
          </div>
        )}
        <Panel className="full-panel">{dismissed ? <DismissedList /> : <PeopleTable />}</Panel>
        {adding && <AddManualWorkerDialog onClose={() => setAdding(false)} />}
        {dismissing && <DismissWorkerDialog onClose={() => setDismissing(false)} />}
      </div>
    </AppShell>
  )
}
