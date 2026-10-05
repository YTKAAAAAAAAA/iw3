/** Where the browser loads a company's logo. An uploaded file wins over the
 *  old free-text `logo_url`; the key in the query string changes with every
 *  upload, so a replaced logo is never served from the browser cache. */
export const companyLogoUrl = (companyId: number, logoKey: string | null, legacyUrl: string | null = null) =>
  logoKey ? `/api/companies/c-${companyId}/logo?v=${logoKey.slice(0, 8)}` : legacyUrl
