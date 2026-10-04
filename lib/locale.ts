export type Locale = 'en' | 'nl'

export function preferredLocale(languages: readonly string[]): Locale {
  return languages.some(language => language.toLowerCase().startsWith('nl')) ? 'nl' : 'en'
}
