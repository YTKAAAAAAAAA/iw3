'use client'

import { createContext, useContext, useEffect, useMemo, useState, type ReactNode } from 'react'
import { preferredLocale, type Locale } from './locale'
export type { Locale } from './locale'

const STORAGE_KEY = 'iaw-locale'

const dutch: Record<string, string> = {
  'Overview': 'Overzicht',
  'People': 'Medewerkers',
  'Vacancies': 'Vacatures',
  'Open': 'Open',
  'In progress': 'In uitvoering',
  'Archived': 'Gearchiveerd',
  'Archive vacancy': 'Vacature archiveren',
  'Restore vacancy': 'Vacature herstellen',
  'Could not update vacancy archive status.': 'De archiveringsstatus van de vacature kon niet worden bijgewerkt.',
  'This vacancy ended. Update its end date before restoring it.': 'Deze vacature is beëindigd. Wijzig eerst de einddatum om deze te herstellen.',
  'Hours': 'Uren',
  'Companies': 'Bedrijven',
  'Workspace': 'Werkruimte',
  'Sync sources': 'Gegevensbronnen synchroniseren',
  'Sign out': 'Uitloggen',
  'Hide navigation': 'Navigatie verbergen',
  'Show navigation': 'Navigatie tonen',
  'Open navigation': 'Navigatie openen',
  'Close navigation': 'Navigatie sluiten',
  'Search': 'Zoeken',
  'Search everything': 'Alles doorzoeken',
  'Search everything, including dismissed people': 'Alles doorzoeken, inclusief voormalige medewerkers',
  'Search people (including dismissed), companies, vacancies…': 'Medewerkers (ook voormalige), bedrijven en vacatures zoeken…',
  'Start typing to search people, companies and vacancies.': 'Begin met typen om medewerkers, bedrijven en vacatures te zoeken.',
  'Nothing matches “{query}”.': 'Geen resultaten voor “{query}”.',
  'Person': 'Medewerker',
  'Company': 'Bedrijf',
  'Vacancy': 'Vacature',
  'Dismissed': 'Uit dienst',
  'No city on file': 'Geen woonplaats bekend',
  'No contact on file': 'Geen contactpersoon bekend',
  'Light theme': 'Licht thema',
  'Dark theme': 'Donker thema',
  'Language': 'Taal',
  'English': 'Engels',
  'Dutch': 'Nederlands',
  'Switch language to English': 'Taal wijzigen naar Engels',
  'Switch language to Dutch': 'Taal wijzigen naar Nederlands',
  'Workforce directory': 'Medewerkersoverzicht',
  'Historical records remain available for reports and hours.': 'Historische gegevens blijven beschikbaar voor rapportages en uren.',
  'Manage availability, company access and assignments.': 'Beheer beschikbaarheid, toegang tot bedrijven en diensten.',
  'Active people': 'Actieve medewerkers',
  'View dismissed': 'Bekijk medewerkers uit dienst',
  'Dismissed people': 'Medewerkers uit dienst',
  'Dismiss manually': 'Handmatig uit dienst melden',
  'Dismiss a worker': 'Medewerker uit dienst melden',
  'The worker and their shift history will remain saved. Flexpedia profile sync will not change this status.': 'De medewerker en de diensthistorie blijven bewaard. De Flexpedia-profielsynchronisatie wijzigt deze status niet.',
  'Select a person': 'Selecteer een medewerker',
  'Dismiss': 'Uit dienst melden',
  'Dismiss {name}? Their shifts and history will be preserved.': '{name} uit dienst melden? De diensten en historie blijven behouden.',
  'Could not dismiss this person.': 'Deze medewerker kon niet uit dienst worden gemeld.',
  'Could not dismiss this person. Please try again.': 'Deze medewerker kon niet uit dienst worden gemeld. Probeer het opnieuw.',
  'Add manually': 'Handmatig toevoegen',
  'Add person manually': 'Medewerker handmatig toevoegen',
  'This person can be linked to Flexpedia later without replacing their local schedule history.': 'Deze medewerker kan later aan Flexpedia worden gekoppeld zonder de bestaande lokale planningsgeschiedenis te vervangen.',
  'Full name': 'Volledige naam',
  'First and last name': 'Voor- en achternaam',
  'Company access': 'Toegang tot bedrijven',
  'Create a company before adding a person.': 'Maak eerst een bedrijf aan voordat je een medewerker toevoegt.',
  'Cancel': 'Annuleren',
  'Saving…': 'Opslaan…',
  'Add person': 'Medewerker toevoegen',
  'Add as a separate person': 'Als aparte medewerker toevoegen',
  'same name': 'dezelfde naam',
  'The first dispatcher to choose will decide for everyone submitting this same name; selecting an existing person never merges records.': 'De eerste planner die een keuze maakt, bepaalt deze voor iedereen die dezelfde naam invoert; een bestaande medewerker kiezen voegt geen dossiers samen.',
  'This identity was already resolved by another dispatcher. The shared choice is shown below; no duplicate was created.': 'Een andere planner heeft deze identiteit al beoordeeld. De gedeelde keuze staat hieronder; er is geen duplicaat aangemaakt.',
  'Your choice is now shared. Other dispatchers will use this same person.': 'Je keuze is nu gedeeld. Andere planners gebruiken dezelfde medewerker.',
  'Could not save the person.': 'De medewerker kon niet worden opgeslagen.',
  'Could not save the person. Please try again.': 'De medewerker kon niet worden opgeslagen. Probeer het opnieuw.',
  'Possible existing people were found.': 'Er zijn mogelijk al bestaande medewerkers gevonden.',
  'Choose this person': 'Deze medewerker kiezen',
  'A phone number may be shared. This will create a separate person and will not link or merge records.': 'Een telefoonnummer kan gedeeld zijn. Dit maakt een aparte medewerker aan en koppelt of voegt geen dossiers samen.',
  'Open {name}': '{name} openen',
  'No dismissed people': 'Geen voormalige medewerkers',
  'Dismissed workers will appear here so they can be restored.': 'Voormalige medewerkers verschijnen hier en kunnen worden hersteld.',
  'Restore': 'Herstellen',
  'Restoring…': 'Herstellen…',
  'Could not restore this person.': 'Deze medewerker kon niet worden hersteld.',
  'Could not restore this person. Please try again.': 'Deze medewerker kon niet worden hersteld. Probeer het opnieuw.',
  'Open vacancies': 'Openstaande vacatures',
  'People available': 'Beschikbare medewerkers',
  'On leave today': 'Vandaag afwezig',
  'Total people': 'Totaal aantal medewerkers',
  'Today’s availability': 'Beschikbaarheid vandaag',
  'People ready for assignment': 'Medewerkers beschikbaar voor een dienst',
  'View people': 'Medewerkers bekijken',
  'Coming up': 'Aankomend',
  'Leave and roster overview': 'Overzicht van afwezigheid en planning',
  'Available': 'Beschikbaar',
  'Working': 'Ingepland',
  'Leave': 'Afwezig',
  'Free': 'Vrij',
  'Search people': 'Medewerkers zoeken',
  'All companies': 'Alle bedrijven',
  'All availability': 'Alle beschikbaarheid',
  'More filters': 'Meer filters',
  'Company filter': 'Bedrijfsfilter',
  'Availability filter': 'Beschikbaarheidsfilter',
  'Availability date': 'Beschikbaarheidsdatum',
  'Showing {from}–{to} of {count} people': '{from}–{to} van {count} medewerkers weergegeven',
  'Phone': 'Telefoon',
  'Availability · {date}': 'Beschikbaarheid · {date}',
  'Open profile': 'Profiel openen',
  'Rostered shift': 'Ingeplande dienst',
  'On leave': 'Afwezig',
  'Ready for assignment': 'Beschikbaar voor een dienst',
  'and': 'en',
  'Close': 'Sluiten',
  'saved hours': 'geregistreerde uren',
  'Actions': 'Acties',
  'Previous month': 'Vorige maand',
  'Next month': 'Volgende maand',
  'Mon': 'ma',
  'Tue': 'di',
  'Wed': 'wo',
  'Thu': 'do',
  'Fri': 'vr',
  'Sat': 'za',
  'Sun': 'zo',
  'Click to pick · shift-click for a span': 'Klik om te selecteren · shift-klik voor een periode',
  'days selected': 'dagen geselecteerd',
  'Nothing picked yet': 'Nog geen dagen geselecteerd',
  'Clear': 'Wissen',
  'Pick one or more days in the calendar above.': 'Selecteer hierboven een of meer dagen in de kalender.',
  'Paid leave': 'Betaald verlof',
  'Unpaid leave': 'Onbetaald verlof',
  'Remove day off': 'Vrije dag verwijderen',
  'Remove {count} days off': '{count} vrije dagen verwijderen',
  'Selected days that are marked off': 'Geselecteerde dagen die als vrij zijn gemarkeerd',
  'Reason': 'Reden',
  'Day off reason': 'Reden voor vrije dag',
  'Mark as day off': 'Als vrije dag markeren',
  'Mark {count} days off': '{count} dagen als vrij markeren',
  'Could not save time off.': 'Vrije dag kon niet worden opgeslagen.',
  'Could not remove time off.': 'Vrije dag kon niet worden verwijderd.',
  'Create vacancy': 'Vacature aanmaken',
  'Who normally works here': 'Wie werkt hier normaal?',
  'Create shifts from these arrangements for the days shown': 'Maak diensten aan op basis van deze vaste afspraken voor de getoonde dagen',
  'Create shifts for these days': 'Diensten voor deze dagen aanmaken',
  'Schedule': 'Planning',
  'Hide the day-by-day plan': 'Dagplanning verbergen',
  'Day-by-day plan · {count} shifts placed': 'Dagplanning · {count} diensten ingepland',
  'Share view': 'Planning delen',
  'Available people': 'Beschikbare medewerkers',
  'Add slot': 'Dienst toevoegen',
  'Not a working day.': 'Geen werkdag.',
  'People ordered': 'Aantal medewerkers besteld',
  'ordered': 'besteld',
  '{count} people, numbered for the client': '{count} medewerkers, genummerd voor de opdrachtgever',
  'total vacancies': 'vacatures in totaal',
  'active people': 'actieve medewerkers',
  'Leave takes priority over work': 'Afwezigheid gaat voor werk',
  'dismissed workers': 'medewerkers uit dienst',
  'Here’s what’s happening across your workforce today.': 'Dit gebeurt er vandaag binnen je personeelsbestand.',
  'Available today': 'Vandaag beschikbaar',
  'Recently active and available workers': 'Recent actieve en beschikbare medewerkers',
  'View all people': 'Alle medewerkers bekijken',
  'Worker profile': 'Medewerkersprofiel',
  'No people match these filters': 'Geen medewerkers gevonden met deze filters',
  'Try changing the date, access company, or availability.': 'Wijzig de datum, het bedrijf of de beschikbaarheidsfilter.',
  'History': 'Geschiedenis',
  'Status': 'Status',
  'Dismissed on {date}. This record is read-only except internal notes.': 'Uit dienst sinds {date}. Dit dossier is alleen-lezen, behalve interne notities.',
  'Sign in': 'Inloggen',
  'Enter the dispatcher password to continue.': 'Voer het wachtwoord van de planner in om door te gaan.',
  'Password changed. Sign in with the new password.': 'Het wachtwoord is gewijzigd. Log in met het nieuwe wachtwoord.',
  'Password': 'Wachtwoord',
  'Change password': 'Wachtwoord wijzigen',
  'Choose a new password with at least 12 characters.': 'Kies een nieuw wachtwoord van minimaal 12 tekens.',
  'Map & travel': 'Kaart en reistijd',
  'Who is within a drive of a site, and how far each of them actually travels.': 'Welke medewerkers binnen rijafstand van een locatie wonen en hoe ver zij daadwerkelijk reizen.',
  'Matching': 'Koppelen',
  'Within': 'Binnen',
  'km by car': 'km met de auto',
  'Everyone': 'Iedereen',
  'With car': 'Met auto',
  'People nearby': 'Medewerkers in de buurt',
  'Road distance · driving time, one way': 'Afstand over de weg · reistijd, enkele reis',
  'Nobody with a car within this drive': 'Geen medewerkers met auto binnen deze rijafstand',
  'Nobody within this drive': 'Geen medewerkers binnen deze rijafstand',
  'Widen the radius, or switch the car filter off to see everyone.': 'Vergroot de straal of schakel het autofilter uit om iedereen te zien.',
  'Widen the radius, or change the filter.': 'Vergroot de straal of wijzig het filter.',
  'Map': 'Kaart',
  'Satellite': 'Satelliet',
  'The dashed ring is straight-line {radius} km, shown only for scale — membership is decided by road distance.': 'De gestreepte cirkel toont alleen ter referentie {radius} km hemelsbreed — indeling gebeurt op basis van afstand over de weg.',
  'Road distances to {address}, one way, computed {date} with {profile}. Frozen deliberately: travel money is paid on these kilometres, so they change only when an address does.': 'Afstanden over de weg naar {address}, enkele reis, berekend op {date} met {profile}. Deze afstanden zijn vastgezet omdat reiskosten hierop zijn gebaseerd; ze veranderen alleen als een adres wijzigt.',
  'Daily work report': 'Dagrapport',
  'Attach photos from this workday. They are private and do not appear in Share view.': 'Voeg foto’s van deze werkdag toe. Ze zijn privé en worden niet getoond in de gedeelde planning.',
  'Loading photos…': 'Foto’s laden…',
  'Saving photos…': 'Foto’s opslaan…',
  'Delete photo': 'Foto verwijderen',
  'Sync request failed': 'Synchronisatie mislukt',
  'Last sync': 'Laatste synchronisatie',
  'Warehouse — Supabase snapshot': 'Warehouse — Supabase-kopie',
  'Workers, Warehouse shifts, and absence periods.': 'Medewerkers, Warehouse-diensten en afwezigheidsperioden.',
  'No database writes': 'Geen wijzigingen in de database',
  'Local workforce history': 'Lokale medewerkerhistorie',
  'Synced records and local scheduling remain in the Docker PostgreSQL database.': 'Gesynchroniseerde gegevens en lokale planning blijven in de Docker-PostgreSQL-database staan.',
  'Close search': 'Zoeken sluiten',
  'Photos stay out of the shared schedule': 'Foto’s blijven buiten de gedeelde planning',
  'photo': 'foto',
  'photos': 'foto’s',
  'Close report': 'Rapport sluiten',
  'Add photos': 'Foto’s toevoegen',
  'Choose photos for': 'Foto’s kiezen voor',
  'Workday report': 'Werkdagrapport',
  'Coordinates entered directly': 'Coördinaten rechtstreeks ingevoerd',
  'Search an address, or paste 52.3138, 4.9377': 'Zoek een adres of plak 52.3138, 4.9377',
  'Search the site address': 'Zoek het adres van de locatie',
  'Searching…': 'Zoeken…',
  'Nothing found. Try the postcode and house number — in the Netherlands that pair is unique.': 'Geen resultaten. Probeer de postcode en het huisnummer; in Nederland vormt die combinatie een uniek adres.',
  'The address service did not answer. You can paste coordinates instead.': 'De adresdienst reageert niet. Je kunt ook coördinaten plakken.',
  'Change': 'Wijzigen',
  'Nothing is saved until an address is picked — an address with no coordinates cannot be used for distances.': 'Er wordt niets opgeslagen voordat je een adres selecteert. Een adres zonder coördinaten kan niet voor afstandsberekeningen worden gebruikt.',
  'Current password': 'Huidig wachtwoord',
  'New password': 'Nieuw wachtwoord',
  'Repeat new password': 'Nieuw wachtwoord herhalen',
  'Back to planner': 'Terug naar de planner',
  'Signing in…': 'Inloggen…',
  'Invalid password.': 'Onjuist wachtwoord.',
  'Too many attempts. Please try again later.': 'Te veel pogingen. Probeer het later opnieuw.',
  'The current password is incorrect.': 'Het huidige wachtwoord is onjuist.',
  'The passwords do not match.': 'De wachtwoorden komen niet overeen.',
  'Password must be at least 12 characters.': 'Het wachtwoord moet minimaal 12 tekens bevatten.',
  'Could not change the password. Please try again.': 'Het wachtwoord kon niet worden gewijzigd. Probeer het opnieuw.',
  'Could not sign in.': 'Inloggen is niet gelukt.',
  'Enter the password.': 'Voer het wachtwoord in.',
  'Password is too long.': 'Het wachtwoord is te lang.',
  'Session expired — sign in again.': 'Je sessie is verlopen — log opnieuw in.',
  'Enter both passwords.': 'Vul beide wachtwoorden in.',
  'New password must be at least 12 characters.': 'Het nieuwe wachtwoord moet minimaal 12 tekens bevatten.',
  'New password is too long.': 'Het nieuwe wachtwoord is te lang.',
  'The new passwords do not match.': 'De nieuwe wachtwoorden komen niet overeen.',
  'Could not change the password.': 'Het wachtwoord kon niet worden gewijzigd.',
  'Account not found.': 'Account niet gevonden.',
  'Current password is wrong.': 'Het huidige wachtwoord is onjuist.',
  'Synced 28 min ago': '28 minuten geleden gesynchroniseerd',
  'Syncing…': 'Synchroniseren…',
  'Data connections': 'Gegevenskoppelingen',
  'Warehouse history stays in PostgreSQL when you switch data sources.': 'De Warehouse-historie blijft in PostgreSQL staan wanneer je van gegevensbron wisselt.',
  'Loading': 'Laden',
  'Enabled': 'Ingeschakeld',
  'Disabled': 'Uitgeschakeld',
  'Never': 'Nooit',
  'Last sync error:': 'Fout bij laatste synchronisatie:',
  'Last result: {workersAdded} workers added, {workersUpdated} updated; {shiftsAdded} shifts added, {shiftsUpdated} updated, {shiftsDeleted} deleted; {absencesAdded} absences added, {absencesUpdated} updated, {absencesDeleted} deleted.': 'Laatste resultaat: {workersAdded} medewerkers toegevoegd, {workersUpdated} bijgewerkt; {shiftsAdded} diensten toegevoegd, {shiftsUpdated} bijgewerkt, {shiftsDeleted} verwijderd; {absencesAdded} afwezigheden toegevoegd, {absencesUpdated} bijgewerkt, {absencesDeleted} verwijderd.',
  'workers added,': 'medewerkers toegevoegd,',
  'updated;': 'bijgewerkt;',
  'shifts added,': 'diensten toegevoegd,',
  'absences added.': 'afwezigheden toegevoegd.',
  'Working…': 'Bezig…',
  'Sync Warehouse now': 'Warehouse nu synchroniseren',
  'Disable Supabase sync': 'Supabase-synchronisatie uitschakelen',
  'Enable Supabase sync': 'Supabase-synchronisatie inschakelen',
  'Set SUPABASE_DATABASE_URL in .env and restart the app to enable sync.': 'Stel SUPABASE_DATABASE_URL in .env in en start de app opnieuw om synchronisatie in te schakelen.',
  'Sync is a read-only Supabase snapshot. Imported shifts and absences are reconciled by source ID, including source deletions. Local-only records are not removed. When a source shift is deleted, its shift and attached offer records are deleted too.': 'De Supabase-snapshot wordt alleen gelezen. Geïmporteerde diensten en afwezigheden worden op basis van bron-ID gesynchroniseerd, inclusief verwijderingen uit de bron. Alleen lokaal aangemaakte records blijven behouden. Als een dienst uit de bron wordt verwijderd, worden ook de dienst en bijbehorende aanbiedingsrecords verwijderd.',
  'Warehouse snapshot reconciled. Source-linked shifts and absences now match Supabase; local-only records remain.': 'Warehouse-snapshot bijgewerkt. Diensten en afwezigheden met een bronkoppeling komen nu overeen met Supabase; alleen lokaal aangemaakte gegevens blijven behouden.',
  'Flexpedia employee sync': 'Flexpedia-medewerkers synchroniseren',
  'Flexpedia updates employee profiles only. Manage employment status manually here.': 'Flexpedia werkt alleen medewerkerprofielen bij. Beheer de arbeidsstatus hier handmatig.',
  'Sync Flexpedia employees': 'Flexpedia-medewerkers synchroniseren',
  'Last Flexpedia result: {employeesAdded} added, {employeesUpdated} profiles updated. Employment status is managed manually.': 'Laatste Flexpedia-resultaat: {employeesAdded} toegevoegd, {employeesUpdated} profielen bijgewerkt. De arbeidsstatus wordt handmatig beheerd.',
  'Flexpedia sync completed — new employees added: {employeesAdded}; profiles updated: {employeesUpdated}. Employment status is managed manually.': 'Flexpedia-synchronisatie voltooid — nieuwe medewerkers toegevoegd: {employeesAdded}; profielen bijgewerkt: {employeesUpdated}. De arbeidsstatus wordt handmatig beheerd.',
  'Flexpedia profile fields are authoritative, including null values. Flexpedia sync never dismisses or reactivates employees. Use the People page to change employment status; shifts, absences, hours, and work history remain. New employees are added without company access until assigned locally.': 'Flexpedia is leidend voor profielvelden, ook als een waarde leeg is. De Flexpedia-synchronisatie meldt medewerkers niet uit dienst en activeert hen niet opnieuw. Beheer de arbeidsstatus op de medewerkerspagina; diensten, afwezigheden, uren en werkhistorie blijven behouden. Nieuwe medewerkers krijgen pas toegang tot een bedrijf wanneer die hier wordt toegewezen.',
  'Flexpedia returned an empty employee snapshot; synchronization was stopped and no employee data was changed.': 'Flexpedia gaf een lege medewerkerslijst terug; de synchronisatie is gestopt en er zijn geen medewerkersgegevens gewijzigd.',
  'A Flexpedia employee matches multiple local workers by name; resolve the identity before syncing.': 'Een Flexpedia-medewerker komt overeen met meerdere lokale medewerkers op basis van de naam. Los deze identiteit op voordat je synchroniseert.',
  'A Flexpedia employee name belongs to a worker linked to a different Flexpedia ID.': 'Deze Flexpedia-naam is al gekoppeld aan een medewerker met een ander Flexpedia-ID.',
  'A matched Flexpedia worker could not be loaded.': 'De gekoppelde Flexpedia-medewerker kon niet worden geladen.',
  'Flexpedia — connection test': 'Flexpedia — verbindingstest',
  'Read-only employee preview; Flexpedia does not provide Warehouse shifts.': 'Alleen-lezen voorbeeld van medewerkers; Flexpedia levert geen Warehouse-diensten.',
  'Token configured': 'Token ingesteld',
  'Not configured': 'Niet ingesteld',
  'Test Flexpedia connection': 'Flexpedia-verbinding testen',
  'Set FLEXPEDIA_API_TOKEN in .env and restart the app before testing.': 'Stel FLEXPEDIA_API_TOKEN in .env in en start de app opnieuw voordat je test.',
  'Flexpedia — isolated merge fixture': 'Flexpedia — geïsoleerde samenvoegtest',
  'One existing worker and one synthetic new employee, using all 18 documented EmployeeModel fields.': 'Eén bestaande medewerker en één fictieve nieuwe medewerker, met alle 18 gedocumenteerde EmployeeModel-velden.',
  'Optional fields may be null in real API responses. The preview replaces the profile from Flexpedia; shifts, course days, and absences stay unchanged.': 'Optionele velden kunnen in echte API-antwoorden leeg zijn. De preview vervangt profielgegevens door de gegevens uit Flexpedia; diensten, cursusdagen en afwezigheden blijven ongewijzigd.',
  'Preview one-time fixture': 'Eenmalige testgegevens bekijken',
  'Turning off Supabase only stops future imports. It does not clear Warehouse records already imported. Flexpedia sync updates employee profiles; employment status is managed manually, while shift schedules, absence history, and manually entered hours remain in the local database.': 'Supabase uitschakelen stopt alleen toekomstige imports. Eerder geïmporteerde Warehouse-gegevens blijven behouden. De Flexpedia-synchronisatie werkt alleen medewerkerprofielen bij; de arbeidsstatus wordt handmatig beheerd. Dienstroosters, afwezigheidshistorie en handmatig ingevoerde uren blijven in de lokale database.',
}

type LanguageContextValue = {
  locale: Locale
  setLocale: (locale: Locale) => void
  t: (message: string, values?: Record<string, string | number>) => string
}

const LanguageContext = createContext<LanguageContextValue | null>(null)

function browserLocale(): Locale {
  return preferredLocale(navigator.languages)
}

export function LanguageProvider({ children }: { children: ReactNode }) {
  const [locale, setLocaleState] = useState<Locale>('en')

  useEffect(() => {
    let stored: string | null = null
    try {
      stored = window.localStorage.getItem(STORAGE_KEY)
    } catch {
      stored = null
    }
    const initial = stored === 'en' || stored === 'nl' ? stored : browserLocale()
    setLocaleState(initial)
    document.documentElement.lang = initial

    const onStorage = (event: StorageEvent) => {
      if (event.key !== STORAGE_KEY || (event.newValue !== 'en' && event.newValue !== 'nl')) return
      setLocaleState(event.newValue)
      document.documentElement.lang = event.newValue
    }
    window.addEventListener('storage', onStorage)
    return () => window.removeEventListener('storage', onStorage)
  }, [])

  const setLocale = (next: Locale) => {
    try {
      window.localStorage.setItem(STORAGE_KEY, next)
    } catch {
      // Keep the selected language for the current session if storage is unavailable.
    }
    setLocaleState(next)
    document.documentElement.lang = next
  }

  const value = useMemo<LanguageContextValue>(() => ({
    locale,
    setLocale,
    t: (message, values = {}) => {
      const translated = locale === 'nl' ? dutch[message] ?? message : message
      return translated.replace(/\{(\w+)\}/g, (match, key: string) =>
        key in values ? String(values[key]) : match)
    },
  }), [locale])

  return <LanguageContext.Provider value={value}>{children}</LanguageContext.Provider>
}

export function useLanguage(): LanguageContextValue {
  const context = useContext(LanguageContext)
  if (!context) throw new Error('LanguageProvider is missing.')
  return context
}

export function LanguageSwitcher() {
  const { locale, setLocale, t } = useLanguage()
  return <div className="locale-switch" role="group" aria-label={t('Language')}>
    <span>{t('Language')}</span>
    <button type="button" aria-label={t('Switch language to English')} aria-pressed={locale === 'en'}
      className={locale === 'en' ? 'active' : ''} onClick={() => setLocale('en')}>EN</button>
    <button type="button" aria-label={t('Switch language to Dutch')} aria-pressed={locale === 'nl'}
      className={locale === 'nl' ? 'active' : ''} onClick={() => setLocale('nl')}>NL</button>
  </div>
}
