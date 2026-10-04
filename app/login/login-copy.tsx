'use client'

import { LanguageSwitcher, useLanguage } from '@/lib/i18n'

export function LoginCopy({ passwordChanged }: { passwordChanged: boolean }) {
  const { t } = useLanguage()
  return <>
    <LanguageSwitcher />
    <h1 id="login-title">{t('Sign in')}</h1>
    <p>{t('Enter the dispatcher password to continue.')}</p>
    {passwordChanged && <p className="auth-notice" role="status">{t('Password changed. Sign in with the new password.')}</p>}
  </>
}
