'use client'

import { LanguageSwitcher, useLanguage } from '@/lib/i18n'

export function PasswordCopy() {
  const { t } = useLanguage()
  return <>
    <LanguageSwitcher />
    <h1 id="password-title">{t('Change password')}</h1>
    <p>{t('Choose a new password with at least 12 characters.')}</p>
  </>
}
