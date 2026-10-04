'use client'

import { createContext, useContext, useEffect, useMemo, useState, type ReactNode } from 'react'
import { preferredLocale, type Locale } from './locale'
export type { Locale } from './locale'

const STORAGE_KEY = 'iaw-locale'

const dutch: Record<string, string> = {
  Overview: 'Overzicht',
  People: 'Medewerkers',
  Vacancies: 'Vacatures',
  Open: 'Open',
  'In progress': 'In uitvoering',
  Archived: 'Gearchiveerd',
  'Archive vacancy': 'Vacature archiveren',
  'Restore vacancy': 'Vacature herstellen',
  'Could not update vacancy archive status.':
    'De archiveringsstatus van de vacature kon niet worden bijgewerkt.',
  'This vacancy ended. Update its end date before restoring it.':
    'Deze vacature is beëindigd. Wijzig eerst de einddatum om deze te herstellen.',
  Hours: 'Uren',
  Companies: 'Bedrijven',
  Workspace: 'Werkruimte',
  'Sync sources': 'Gegevensbronnen synchroniseren',
  'Sign out': 'Uitloggen',
  'Hide navigation': 'Navigatie verbergen',
  'Show navigation': 'Navigatie tonen',
  'Open navigation': 'Navigatie openen',
  'Close navigation': 'Navigatie sluiten',
  Search: 'Zoeken',
  'Search everything': 'Alles doorzoeken',
  'Search everything, including dismissed people': 'Alles doorzoeken, inclusief voormalige medewerkers',
  'Search people (including dismissed), companies, vacancies…':
    'Medewerkers (ook voormalige), bedrijven en vacatures zoeken…',
  'Start typing to search people, companies and vacancies.':
    'Begin met typen om medewerkers, bedrijven en vacatures te zoeken.',
  'Nothing matches “{query}”.': 'Geen resultaten voor “{query}”.',
  Person: 'Medewerker',
  Company: 'Bedrijf',
  Vacancy: 'Vacature',
  Dismissed: 'Uit dienst',
  'No city on file': 'Geen woonplaats bekend',
  'No contact on file': 'Geen contactpersoon bekend',
  'Light theme': 'Licht thema',
  'Dark theme': 'Donker thema',
  Language: 'Taal',
  English: 'Engels',
  Dutch: 'Nederlands',
  'Switch language to English': 'Taal wijzigen naar Engels',
  'Switch language to Dutch': 'Taal wijzigen naar Nederlands',
  'Workforce directory': 'Medewerkersoverzicht',
  'Historical records remain available for reports and hours.':
    'Historische gegevens blijven beschikbaar voor rapportages en uren.',
  'Manage availability, company access and assignments.':
    'Beheer beschikbaarheid, toegang tot bedrijven en diensten.',
  'Active people': 'Actieve medewerkers',
  'View dismissed': 'Bekijk medewerkers uit dienst',
  'Dismissed people': 'Medewerkers uit dienst',
  'Dismiss manually': 'Handmatig uit dienst melden',
  'Dismiss a worker': 'Medewerker uit dienst melden',
  'The worker and their shift history will remain saved. Flexpedia profile sync will not change this status.':
    'De medewerker en de diensthistorie blijven bewaard. De Flexpedia-profielsynchronisatie wijzigt deze status niet.',
  'Select a person': 'Selecteer een medewerker',
  Dismiss: 'Uit dienst melden',
  'Dismiss {name}? Their shifts and history will be preserved.':
    '{name} uit dienst melden? De diensten en historie blijven behouden.',
  'Could not dismiss this person.': 'Deze medewerker kon niet uit dienst worden gemeld.',
  'Could not dismiss this person. Please try again.':
    'Deze medewerker kon niet uit dienst worden gemeld. Probeer het opnieuw.',
  'Add manually': 'Handmatig toevoegen',
  'Add person manually': 'Medewerker handmatig toevoegen',
  'This person can be linked to Flexpedia later without replacing their local schedule history.':
    'Deze medewerker kan later aan Flexpedia worden gekoppeld zonder de bestaande lokale planningsgeschiedenis te vervangen.',
  'Full name': 'Volledige naam',
  'First and last name': 'Voor- en achternaam',
  'Company access': 'Toegang tot bedrijven',
  'Create a company before adding a person.':
    'Maak eerst een bedrijf aan voordat je een medewerker toevoegt.',
  Cancel: 'Annuleren',
  'Saving…': 'Opslaan…',
  'Add person': 'Medewerker toevoegen',
  'Add as a separate person': 'Als aparte medewerker toevoegen',
  'same name': 'dezelfde naam',
  'The first dispatcher to choose will decide for everyone submitting this same name; selecting an existing person never merges records.':
    'De eerste planner die een keuze maakt, bepaalt deze voor iedereen die dezelfde naam invoert; een bestaande medewerker kiezen voegt geen dossiers samen.',
  'This identity was already resolved by another dispatcher. The shared choice is shown below; no duplicate was created.':
    'Een andere planner heeft deze identiteit al beoordeeld. De gedeelde keuze staat hieronder; er is geen duplicaat aangemaakt.',
  'Your choice is now shared. Other dispatchers will use this same person.':
    'Je keuze is nu gedeeld. Andere planners gebruiken dezelfde medewerker.',
  'Could not save the person.': 'De medewerker kon niet worden opgeslagen.',
  'Could not save the person. Please try again.':
    'De medewerker kon niet worden opgeslagen. Probeer het opnieuw.',
  'Possible existing people were found.': 'Er zijn mogelijk al bestaande medewerkers gevonden.',
  'Choose this person': 'Deze medewerker kiezen',
  'A phone number may be shared. This will create a separate person and will not link or merge records.':
    'Een telefoonnummer kan gedeeld zijn. Dit maakt een aparte medewerker aan en koppelt of voegt geen dossiers samen.',
  'Open {name}': '{name} openen',
  'No dismissed people': 'Geen voormalige medewerkers',
  'Dismissed workers will appear here so they can be restored.':
    'Voormalige medewerkers verschijnen hier en kunnen worden hersteld.',
  Restore: 'Herstellen',
  'Restoring…': 'Herstellen…',
  'Could not restore this person.': 'Deze medewerker kon niet worden hersteld.',
  'Could not restore this person. Please try again.':
    'Deze medewerker kon niet worden hersteld. Probeer het opnieuw.',
  'Open vacancies': 'Openstaande vacatures',
  'People available': 'Beschikbare medewerkers',
  'On leave today': 'Vandaag afwezig',
  'Total people': 'Totaal aantal medewerkers',
  'Today’s availability': 'Beschikbaarheid vandaag',
  'People ready for assignment': 'Medewerkers beschikbaar voor een dienst',
  'View people': 'Medewerkers bekijken',
  'Coming up': 'Aankomend',
  'Leave and roster overview': 'Overzicht van afwezigheid en planning',
  Available: 'Beschikbaar',
  Working: 'Ingepland',
  Leave: 'Afwezig',
  Free: 'Vrij',
  'Search people': 'Medewerkers zoeken',
  'All companies': 'Alle bedrijven',
  'All availability': 'Alle beschikbaarheid',
  'More filters': 'Meer filters',
  'Company filter': 'Bedrijfsfilter',
  'Availability filter': 'Beschikbaarheidsfilter',
  'Availability date': 'Beschikbaarheidsdatum',
  'Showing {from}–{to} of {count} people': '{from}–{to} van {count} medewerkers weergegeven',
  Phone: 'Telefoon',
  'Availability · {date}': 'Beschikbaarheid · {date}',
  'Open profile': 'Profiel openen',
  'Rostered shift': 'Ingeplande dienst',
  'On leave': 'Afwezig',
  'Ready for assignment': 'Beschikbaar voor een dienst',
  and: 'en',
  Close: 'Sluiten',
  'saved hours': 'geregistreerde uren',
  Actions: 'Acties',
  'Previous month': 'Vorige maand',
  'Next month': 'Volgende maand',
  Mon: 'ma',
  Tue: 'di',
  Wed: 'wo',
  Thu: 'do',
  Fri: 'vr',
  Sat: 'za',
  Sun: 'zo',
  'Click to pick · shift-click for a span': 'Klik om te selecteren · shift-klik voor een periode',
  'days selected': 'dagen geselecteerd',
  'Nothing picked yet': 'Nog geen dagen geselecteerd',
  Clear: 'Wissen',
  'Pick one or more days in the calendar above.': 'Selecteer hierboven een of meer dagen in de kalender.',
  'Paid leave': 'Betaald verlof',
  'Unpaid leave': 'Onbetaald verlof',
  'Remove day off': 'Vrije dag verwijderen',
  'Remove {count} days off': '{count} vrije dagen verwijderen',
  'Selected days that are marked off': 'Geselecteerde dagen die als vrij zijn gemarkeerd',
  Reason: 'Reden',
  'Day off reason': 'Reden voor vrije dag',
  'Mark as day off': 'Als vrije dag markeren',
  'Mark {count} days off': '{count} dagen als vrij markeren',
  'Could not save time off.': 'Vrije dag kon niet worden opgeslagen.',
  'Could not remove time off.': 'Vrije dag kon niet worden verwijderd.',
  'Create vacancy': 'Vacature aanmaken',
  'Who normally works here': 'Wie werkt hier normaal?',
  'Create shifts from these arrangements for the days shown':
    'Maak diensten aan op basis van deze vaste afspraken voor de getoonde dagen',
  'Create shifts for these days': 'Diensten voor deze dagen aanmaken',
  Schedule: 'Planning',
  'Hide the day-by-day plan': 'Dagplanning verbergen',
  'Day-by-day plan · {count} shifts placed': 'Dagplanning · {count} diensten ingepland',
  'Share view': 'Planning delen',
  'Available people': 'Beschikbare medewerkers',
  'Add slot': 'Dienst toevoegen',
  'Not a working day.': 'Geen werkdag.',
  'People ordered': 'Aantal medewerkers besteld',
  ordered: 'besteld',
  '{count} people, numbered for the client': '{count} medewerkers, genummerd voor de opdrachtgever',
  'total vacancies': 'vacatures in totaal',
  'active people': 'actieve medewerkers',
  'Leave takes priority over work': 'Afwezigheid gaat voor werk',
  'dismissed workers': 'medewerkers uit dienst',
  'Here’s what’s happening across your workforce today.':
    'Dit gebeurt er vandaag binnen je personeelsbestand.',
  'Available today': 'Vandaag beschikbaar',
  'Recently active and available workers': 'Recent actieve en beschikbare medewerkers',
  'View all people': 'Alle medewerkers bekijken',
  'Worker profile': 'Medewerkersprofiel',
  'No people match these filters': 'Geen medewerkers gevonden met deze filters',
  'Try changing the date, access company, or availability.':
    'Wijzig de datum, het bedrijf of de beschikbaarheidsfilter.',
  History: 'Geschiedenis',
  Status: 'Status',
  'Dismissed on {date}. This record is read-only except internal notes.':
    'Uit dienst sinds {date}. Dit dossier is alleen-lezen, behalve interne notities.',
  'Sign in': 'Inloggen',
  'Enter the dispatcher password to continue.': 'Voer het wachtwoord van de planner in om door te gaan.',
  'Password changed. Sign in with the new password.':
    'Het wachtwoord is gewijzigd. Log in met het nieuwe wachtwoord.',
  Password: 'Wachtwoord',
  'Change password': 'Wachtwoord wijzigen',
  'Choose a new password with at least 12 characters.': 'Kies een nieuw wachtwoord van minimaal 12 tekens.',
  'Map & travel': 'Kaart en reistijd',
  'Who is within a drive of a site, and how far each of them actually travels.':
    'Welke medewerkers binnen rijafstand van een locatie wonen en hoe ver zij daadwerkelijk reizen.',
  Matching: 'Koppelen',
  Within: 'Binnen',
  'km by car': 'km met de auto',
  Everyone: 'Iedereen',
  'With car': 'Met auto',
  'People nearby': 'Medewerkers in de buurt',
  'Road distance · driving time, one way': 'Afstand over de weg · reistijd, enkele reis',
  'Nobody with a car within this drive': 'Geen medewerkers met auto binnen deze rijafstand',
  'Nobody within this drive': 'Geen medewerkers binnen deze rijafstand',
  'Widen the radius, or switch the car filter off to see everyone.':
    'Vergroot de straal of schakel het autofilter uit om iedereen te zien.',
  'Widen the radius, or change the filter.': 'Vergroot de straal of wijzig het filter.',
  Map: 'Kaart',
  Satellite: 'Satelliet',
  'The dashed ring is straight-line {radius} km, shown only for scale — membership is decided by road distance.':
    'De gestreepte cirkel toont alleen ter referentie {radius} km hemelsbreed — indeling gebeurt op basis van afstand over de weg.',
  'Road distances to {address}, one way, computed {date} with {profile}. Frozen deliberately: travel money is paid on these kilometres, so they change only when an address does.':
    'Afstanden over de weg naar {address}, enkele reis, berekend op {date} met {profile}. Deze afstanden zijn vastgezet omdat reiskosten hierop zijn gebaseerd; ze veranderen alleen als een adres wijzigt.',
  'Daily work report': 'Dagrapport',
  'Attach photos from this workday. They are private and do not appear in Share view.':
    'Voeg foto’s van deze werkdag toe. Ze zijn privé en worden niet getoond in de gedeelde planning.',
  'Loading photos…': 'Foto’s laden…',
  'Saving photos…': 'Foto’s opslaan…',
  'Delete photo': 'Foto verwijderen',
  'Sync request failed': 'Synchronisatie mislukt',
  'Last sync': 'Laatste synchronisatie',
  'Warehouse — Supabase snapshot': 'Warehouse — Supabase-kopie',
  'Workers, Warehouse shifts, and absence periods.':
    'Medewerkers, Warehouse-diensten en afwezigheidsperioden.',
  'No database writes': 'Geen wijzigingen in de database',
  'Local workforce history': 'Lokale medewerkerhistorie',
  'Synced records and local scheduling remain in the Docker PostgreSQL database.':
    'Gesynchroniseerde gegevens en lokale planning blijven in de Docker-PostgreSQL-database staan.',
  'Close search': 'Zoeken sluiten',
  'Photos stay out of the shared schedule': 'Foto’s blijven buiten de gedeelde planning',
  photo: 'foto',
  photos: 'foto’s',
  'Close report': 'Rapport sluiten',
  'Add photos': 'Foto’s toevoegen',
  'Choose photos for': 'Foto’s kiezen voor',
  'Workday report': 'Werkdagrapport',
  'Coordinates entered directly': 'Coördinaten rechtstreeks ingevoerd',
  'Search an address, or paste 52.3138, 4.9377': 'Zoek een adres of plak 52.3138, 4.9377',
  'Search the site address': 'Zoek het adres van de locatie',
  'Searching…': 'Zoeken…',
  'Nothing found. Try the postcode and house number — in the Netherlands that pair is unique.':
    'Geen resultaten. Probeer de postcode en het huisnummer; in Nederland vormt die combinatie een uniek adres.',
  'The address service did not answer. You can paste coordinates instead.':
    'De adresdienst reageert niet. Je kunt ook coördinaten plakken.',
  Change: 'Wijzigen',
  'Nothing is saved until an address is picked — an address with no coordinates cannot be used for distances.':
    'Er wordt niets opgeslagen voordat je een adres selecteert. Een adres zonder coördinaten kan niet voor afstandsberekeningen worden gebruikt.',
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
  'Could not change the password. Please try again.':
    'Het wachtwoord kon niet worden gewijzigd. Probeer het opnieuw.',
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
  'Warehouse history stays in PostgreSQL when you switch data sources.':
    'De Warehouse-historie blijft in PostgreSQL staan wanneer je van gegevensbron wisselt.',
  Loading: 'Laden',
  Enabled: 'Ingeschakeld',
  Disabled: 'Uitgeschakeld',
  Never: 'Nooit',
  'Last sync error:': 'Fout bij laatste synchronisatie:',
  'Last result: {workersAdded} workers added, {workersUpdated} updated; {shiftsAdded} shifts added, {shiftsUpdated} updated, {shiftsDeleted} deleted; {absencesAdded} absences added, {absencesUpdated} updated, {absencesDeleted} deleted.':
    'Laatste resultaat: {workersAdded} medewerkers toegevoegd, {workersUpdated} bijgewerkt; {shiftsAdded} diensten toegevoegd, {shiftsUpdated} bijgewerkt, {shiftsDeleted} verwijderd; {absencesAdded} afwezigheden toegevoegd, {absencesUpdated} bijgewerkt, {absencesDeleted} verwijderd.',
  'workers added,': 'medewerkers toegevoegd,',
  'updated;': 'bijgewerkt;',
  'shifts added,': 'diensten toegevoegd,',
  'absences added.': 'afwezigheden toegevoegd.',
  'Working…': 'Bezig…',
  'Sync Warehouse now': 'Warehouse nu synchroniseren',
  'Disable Supabase sync': 'Supabase-synchronisatie uitschakelen',
  'Enable Supabase sync': 'Supabase-synchronisatie inschakelen',
  'Set SUPABASE_DATABASE_URL in .env and restart the app to enable sync.':
    'Stel SUPABASE_DATABASE_URL in .env in en start de app opnieuw om synchronisatie in te schakelen.',
  'Sync is a read-only Supabase snapshot. Imported shifts and absences are reconciled by source ID, including source deletions. Local-only records are not removed. When a source shift is deleted, its shift and attached offer records are deleted too.':
    'De Supabase-snapshot wordt alleen gelezen. Geïmporteerde diensten en afwezigheden worden op basis van bron-ID gesynchroniseerd, inclusief verwijderingen uit de bron. Alleen lokaal aangemaakte records blijven behouden. Als een dienst uit de bron wordt verwijderd, worden ook de dienst en bijbehorende aanbiedingsrecords verwijderd.',
  'Warehouse snapshot reconciled. Source-linked shifts and absences now match Supabase; local-only records remain.':
    'Warehouse-snapshot bijgewerkt. Diensten en afwezigheden met een bronkoppeling komen nu overeen met Supabase; alleen lokaal aangemaakte gegevens blijven behouden.',
  'Flexpedia employee sync': 'Flexpedia-medewerkers synchroniseren',
  'Flexpedia updates employee profiles only. Manage employment status manually here.':
    'Flexpedia werkt alleen medewerkerprofielen bij. Beheer de arbeidsstatus hier handmatig.',
  'Sync Flexpedia employees': 'Flexpedia-medewerkers synchroniseren',
  'Last Flexpedia result: {employeesAdded} added, {employeesUpdated} profiles updated. Employment status is managed manually.':
    'Laatste Flexpedia-resultaat: {employeesAdded} toegevoegd, {employeesUpdated} profielen bijgewerkt. De arbeidsstatus wordt handmatig beheerd.',
  'Flexpedia sync completed — new employees added: {employeesAdded}; profiles updated: {employeesUpdated}. Employment status is managed manually.':
    'Flexpedia-synchronisatie voltooid — nieuwe medewerkers toegevoegd: {employeesAdded}; profielen bijgewerkt: {employeesUpdated}. De arbeidsstatus wordt handmatig beheerd.',
  'Flexpedia profile fields are authoritative, including null values. Flexpedia sync never dismisses or reactivates employees. Use the People page to change employment status; shifts, absences, hours, and work history remain. New employees are added without company access until assigned locally.':
    'Flexpedia is leidend voor profielvelden, ook als een waarde leeg is. De Flexpedia-synchronisatie meldt medewerkers niet uit dienst en activeert hen niet opnieuw. Beheer de arbeidsstatus op de medewerkerspagina; diensten, afwezigheden, uren en werkhistorie blijven behouden. Nieuwe medewerkers krijgen pas toegang tot een bedrijf wanneer die hier wordt toegewezen.',
  'Flexpedia returned an empty employee snapshot; synchronization was stopped and no employee data was changed.':
    'Flexpedia gaf een lege medewerkerslijst terug; de synchronisatie is gestopt en er zijn geen medewerkersgegevens gewijzigd.',
  'A Flexpedia employee matches multiple local workers by name; resolve the identity before syncing.':
    'Een Flexpedia-medewerker komt overeen met meerdere lokale medewerkers op basis van de naam. Los deze identiteit op voordat je synchroniseert.',
  'A Flexpedia employee name belongs to a worker linked to a different Flexpedia ID.':
    'Deze Flexpedia-naam is al gekoppeld aan een medewerker met een ander Flexpedia-ID.',
  'A matched Flexpedia worker could not be loaded.':
    'De gekoppelde Flexpedia-medewerker kon niet worden geladen.',
  'Flexpedia — connection test': 'Flexpedia — verbindingstest',
  'Read-only employee preview; Flexpedia does not provide Warehouse shifts.':
    'Alleen-lezen voorbeeld van medewerkers; Flexpedia levert geen Warehouse-diensten.',
  'Token configured': 'Token ingesteld',
  'Not configured': 'Niet ingesteld',
  'Test Flexpedia connection': 'Flexpedia-verbinding testen',
  'Set FLEXPEDIA_API_TOKEN in .env and restart the app before testing.':
    'Stel FLEXPEDIA_API_TOKEN in .env in en start de app opnieuw voordat je test.',
  'Flexpedia — isolated merge fixture': 'Flexpedia — geïsoleerde samenvoegtest',
  'One existing worker and one synthetic new employee, using all 18 documented EmployeeModel fields.':
    'Eén bestaande medewerker en één fictieve nieuwe medewerker, met alle 18 gedocumenteerde EmployeeModel-velden.',
  'Optional fields may be null in real API responses. The preview replaces the profile from Flexpedia; shifts, course days, and absences stay unchanged.':
    'Optionele velden kunnen in echte API-antwoorden leeg zijn. De preview vervangt profielgegevens door de gegevens uit Flexpedia; diensten, cursusdagen en afwezigheden blijven ongewijzigd.',
  'Preview one-time fixture': 'Eenmalige testgegevens bekijken',
  'Turning off Supabase only stops future imports. It does not clear Warehouse records already imported. Flexpedia sync updates employee profiles; employment status is managed manually, while shift schedules, absence history, and manually entered hours remain in the local database.':
    'Supabase uitschakelen stopt alleen toekomstige imports. Eerder geïmporteerde Warehouse-gegevens blijven behouden. De Flexpedia-synchronisatie werkt alleen medewerkerprofielen bij; de arbeidsstatus wordt handmatig beheerd. Dienstroosters, afwezigheidshistorie en handmatig ingevoerde uren blijven in de lokale database.',
  'Drag the pin if it landed on the wrong entrance — the distance is measured from exactly here.':
    'Sleep de speld als die bij de verkeerde ingang staat — de afstand wordt precies vanaf hier gemeten.',
  Dispatcher: 'Planner',
  'Workspace directory': 'Bedrijvenoverzicht',
  'Client contacts and access coverage.': 'Contactpersonen van klanten en wie er toegang heeft.',
  'Add company': 'Bedrijf toevoegen',
  '{count} people with access': '{count} medewerkers met toegang',
  'Edit company': 'Bedrijf bewerken',
  'Company name': 'Bedrijfsnaam',
  'Contact person': 'Contactpersoon',
  Name: 'Naam',
  Notes: 'Notities',
  'Logo uploads are not available yet.': "Logo's uploaden is nog niet mogelijk.",
  'Save company': 'Bedrijf opslaan',
  'Time tracking': 'Urenregistratie',
  'Enter manual hours for active, non-archived vacancies.':
    'Voer handmatig uren in voor actieve, niet-gearchiveerde vacatures.',
  'Weekly report': 'Weekrapport',
  Date: 'Datum',
  'Date outside vacancy period': 'Datum valt buiten de looptijd van de vacature',
  Availability: 'Beschikbaarheid',
  'Nobody is on this vacancy on this day': 'Niemand werkt op deze dag bij deze vacature',
  'Assign people to the vacancy first, or pick another date.':
    'Plan eerst medewerkers in op deze vacature, of kies een andere datum.',
  'Save hours': 'Uren opslaan',
  'ISO week': 'ISO-week',
  Year: 'Jaar',
  "Week {week} runs {from} – {to}. The sheet goes out in the client's own layout — their name across the top, our contact lines, one row per person and the signature block at the foot.":
    'Week {week} loopt van {from} tot {to}. Het overzicht gaat in de eigen opmaak van de klant: hun naam bovenaan, onze contactgegevens, één regel per medewerker en het ondertekeningsblok onderaan.',
  Total: 'Totaal',
  person: 'medewerker',
  people: 'medewerkers',
  'Nothing to report for this week': 'Niets te rapporteren voor deze week',
  'Nobody was on the schedule and no hours were typed. Pick another week.':
    'Er stond niemand op de planning en er zijn geen uren ingevoerd. Kies een andere week.',
  'Download Excel': 'Excel downloaden',
  'by car': 'met de auto',
  'No vacancy has a location yet': 'Nog geen enkele vacature heeft een locatie',
  'Open a vacancy, choose Edit and pick its work address. Travel distances are calculated for everyone with a home address from Flexpedia.':
    'Open een vacature, kies Bewerken en selecteer het werkadres. Reisafstanden worden berekend voor iedereen met een woonadres uit Flexpedia.',
  '{inside} of {pool} within {radius} km, with a car': '{inside} van {pool} binnen {radius} km, met auto',
  '{inside} of {pool} within {radius} km': '{inside} van {pool} binnen {radius} km',
  'Zoom in': 'Inzoomen',
  'Zoom out': 'Uitzoomen',
  car: 'auto',
  '{count} without a calculated distance: no home address from Flexpedia yet, or it could not be located.':
    '{count} zonder berekende afstand: nog geen woonadres uit Flexpedia, of het adres kon niet worden gevonden.',
  'Road distances to {address}, one way, last calculated {date} with {profile}. Frozen deliberately: travel money is paid on these kilometres, so they change only when an address does.':
    'Afstanden over de weg naar {address}, enkele reis, laatst berekend op {date} met {profile}. Bewust vastgezet: reiskosten worden over deze kilometers betaald, dus ze veranderen alleen als een adres verandert.',
  'Road distances are calculated every hour for people whose Flexpedia address is known.':
    'Afstanden over de weg worden elk uur berekend voor medewerkers van wie het adres in Flexpedia bekend is.',
  'Selected:': 'Geselecteerd:',
  '{km} km': '{km} km',
  '{count} vacancies in total': '{count} vacatures in totaal',
  'of {count} active people': 'van {count} actieve medewerkers',
  '{active} active · {dismissed} dismissed': '{active} actief · {dismissed} uit dienst',
  'Nobody is free today.': 'Vandaag is niemand vrij.',
  'Current and upcoming absences': 'Huidige en komende afwezigheid',
  'No absences planned.': 'Geen afwezigheid gepland.',
  '— same name': '— dezelfde naam',
  'Dismissed on': 'Uit dienst sinds',
  '{hours} h worked': '{hours} uur gewerkt',
  Pages: "Pagina's",
  Previous: 'Vorige',
  'Page {page} of {pages}': 'Pagina {page} van {pages}',
  Next: 'Volgende',
  'Back to people': 'Terug naar medewerkers',
  Active: 'Actief',
  Male: 'Man',
  Female: 'Vrouw',
  'No home address from Flexpedia yet, so travel distances cannot be calculated for this person.':
    'Nog geen woonadres uit Flexpedia, dus voor deze medewerker kunnen geen reisafstanden worden berekend.',
  'Internal notes': 'Interne notities',
  'Visible to dispatchers only.': 'Alleen zichtbaar voor planners.',
  'Save notes': 'Notities opslaan',
  'Access permits work at company sites; it is not an assignment.':
    'Toegang betekent dat iemand op locaties van dit bedrijf mag werken; het is geen inplanning.',
  Today: 'Vandaag',
  'Past day': 'Voorbije dag',
  'Future day': 'Toekomstige dag',
  'One selected day already passed and can only be viewed.':
    'Eén geselecteerde dag is al voorbij en kan alleen worden bekeken.',
  '{count} selected days already passed and can only be viewed.':
    '{count} geselecteerde dagen zijn al voorbij en kunnen alleen worden bekeken.',
  'Reference for support:': 'Referentie voor ondersteuning:',
  'Try again': 'Opnieuw proberen',
  'Go to overview': 'Naar het overzicht',
  'just now': 'zojuist',
  '{count} min ago': '{count} min geleden',
  '{count} h ago': '{count} uur geleden',
  'Sync problem': 'Synchronisatieprobleem',
  'Sync not set up': 'Synchronisatie niet ingesteld',
  'Synced {when}': 'Gesynchroniseerd {when}',
  'Not synced yet': 'Nog niet gesynchroniseerd',
  'Sync Flexpedia and Supabase now. They also sync every hour.':
    'Flexpedia en Supabase nu synchroniseren. Dat gebeurt ook elk uur vanzelf.',
  'Syncs automatically every {minutes} minutes. You can also sync now.':
    'Synchroniseert automatisch elke {minutes} minuten. Je kunt ook nu synchroniseren.',
  'Automatic sync is off on this server. Sync manually here.':
    'Automatische synchronisatie staat uit op deze server. Synchroniseer hier handmatig.',
  'Supabase is not connected on this server yet. Ask the administrator to set it up.':
    'Supabase is op deze server nog niet gekoppeld. Vraag de beheerder om het in te stellen.',
  Connected: 'Gekoppeld',
  'Not connected': 'Niet gekoppeld',
  'Flexpedia is not connected on this server yet. Ask the administrator to add the API token.':
    'Flexpedia is op deze server nog niet gekoppeld. Vraag de beheerder om de API-token toe te voegen.',
  'Read {employees} employees in {pages} pages; {matched} matched, {unmatched} unmatched, {ambiguous} ambiguous. No records were changed.':
    "{employees} medewerkers gelezen in {pages} pagina's; {matched} gekoppeld, {unmatched} niet gekoppeld, {ambiguous} dubbelzinnig. Er is niets gewijzigd.",
  '{existingMatched} existing worker matched; {existingWouldEnrich} would be updated ({existingFieldsChanged} profile fields changed); {newWouldAdd} new demo worker would be added. Preserved: {assignedShiftsPreserved} shifts, {courseDaysPreserved} course days, {absencesPreserved} absence periods. Covered {apiFieldsCovered} schema fields. No records were written.':
    '{existingMatched} bestaande medewerker gekoppeld; {existingWouldEnrich} zou worden bijgewerkt ({existingFieldsChanged} profielvelden gewijzigd); {newWouldAdd} nieuwe demomedewerker zou worden toegevoegd. Behouden: {assignedShiftsPreserved} diensten, {courseDaysPreserved} cursusdagen, {absencesPreserved} afwezigheidsperiodes. {apiFieldsCovered} schemavelden gecontroleerd. Er is niets opgeslagen.',
  'Synced records and local scheduling stay in the dispatcher database.':
    'Gesynchroniseerde gegevens en de lokale planning blijven in de database van de planner.',
  '{count} workers': '{count} medewerkers',
  Assignments: 'Opdrachten',
  'Client orders and the people assigned to them.':
    'Opdrachten van klanten en de medewerkers die erop staan.',
  Unstaffed: 'Onbezet',
  'Starts soon': 'Begint binnenkort',
  'Hours tracked manually': 'Uren handmatig bijgehouden',
  'No manual hours': 'Geen handmatige uren',
  'No vacancies in this view': 'Geen vacatures in deze weergave',
  'Create a vacancy to start assigning people.': 'Maak een vacature aan om medewerkers in te plannen.',
  Title: 'Titel',
  'e.g. Inbound warehouse team': 'bijv. Inbound magazijnteam',
  'Site address': 'Werkadres',
  Description: 'Omschrijving',
  'What will the team do?': 'Wat gaat het team doen?',
  'Start date': 'Startdatum',
  'End date': 'Einddatum',
  'Open-ended vacancy': 'Vacature zonder einddatum',
  'People per day': 'Medewerkers per dag',
  'Working days': 'Werkdagen',
  'The days the client works. Leave them all off when there is no weekly pattern — then nothing is generated and each day is entered as the client orders it.':
    'De dagen waarop de klant werkt. Laat ze allemaal uit als er geen vast weekpatroon is — dan wordt er niets aangemaakt en wordt elke dag ingevoerd zoals de klant die bestelt.',
  Times: 'Tijden',
  'A normal window — 07:00–16:00. Overtime extends the end.':
    'Een gewoon tijdvak — 07:00–16:00. Overwerk verlengt het einde.',
  'People are told when to be there and go home when the work is done. The rest of that day stays blocked for them.':
    'Medewerkers horen hoe laat ze er moeten zijn en gaan naar huis als het werk klaar is. De rest van die dag blijven ze geblokkeerd.',
  'Nothing is written down but who was there. Use this where times are pointless or the client keeps them.':
    'Er wordt alleen vastgelegd wie er was. Gebruik dit als tijden niet zinvol zijn of de klant ze zelf bijhoudt.',
  'Usual start': 'Gebruikelijke begintijd',
  'Usual end': 'Gebruikelijke eindtijd',
  'Places on site': 'Locaties ter plaatse',
  'Add a hall…': 'Hal toevoegen…',
  Add: 'Toevoegen',
  'Halls the client orders separately — Slego, Conakryweg. None means the site is ordered as a whole.':
    'Hallen die de klant apart bestelt — Slego, Conakryweg. Geen betekent dat de locatie als geheel wordt besteld.',
  Requirements: 'Eisen',
  'Requirement type': 'Soort eis',
  Skill: 'Vaardigheid',
  Document: 'Document',
  Transport: 'Vervoer',
  Requirement: 'Eis',
  Required: 'Verplicht',
  Remove: 'Verwijderen',
  'New requirement type': 'Soort nieuwe eis',
  'New requirement': 'Nieuwe eis',
  'e.g. Warehouse experience': 'bijv. Ervaring in een magazijn',
  'Add requirement': 'Eis toevoegen',
  'Required items block a candidate when their profile confirms a mismatch. Unrecorded qualifications remain a warning to verify.':
    'Verplichte eisen blokkeren een kandidaat als het profiel bevestigt dat hij er niet aan voldoet. Niet vastgelegde kwalificaties blijven een waarschuwing om te controleren.',
  'Client requires a list of available people': 'Klant wil een lijst met beschikbare medewerkers',
  'Reachable by car only — people without one cannot be placed here':
    'Alleen met de auto bereikbaar — medewerkers zonder auto kunnen hier niet worden ingepland',
  'Track hours manually': 'Uren handmatig bijhouden',
  'Default hours per day': 'Standaard uren per dag',
  'Everyone on the schedule that day starts with this. Clearing a cell puts it back.':
    'Iedereen op de planning van die dag begint hiermee. Een cel leegmaken zet de waarde terug.',
  'Project code': 'Projectcode',
  "The client's own code, printed in their weekly sheet.":
    'De eigen code van de klant, zoals die op hun weekoverzicht staat.',
  '← Back to vacancies': '← Terug naar vacatures',
  'Add a client order without storing computed status.':
    'Voeg een opdracht van een klant toe; de status wordt automatisch bepaald.',
  'Creating…': 'Aanmaken…',
  'Vacancy detail': 'Vacaturedetails',
  'Open-ended': 'Zonder einddatum',
  'Hours not tracked manually': 'Uren niet handmatig bijgehouden',
  Details: 'Details',
  'Every field the client can ask us to change.': 'Elk veld dat de klant ons kan vragen te wijzigen.',
  'What the team does here, and how the job is set up.':
    'Wat het team hier doet en hoe het werk is ingericht.',
  Edit: 'Bewerken',
  'Save vacancy': 'Vacature opslaan',
  'No description yet.': 'Nog geen omschrijving.',
  'What this vacancy requires': 'Wat deze vacature vereist',
  Preferred: 'Gewenst',
  'How this object is normally staffed.': 'Hoe deze locatie normaal wordt bezet.',
  'Who is nearby': 'Wie woont in de buurt',
  'Road distance from {address}. Kilometres show on every candidate when picking people; the map is for choosing by eye.':
    'Afstand over de weg vanaf {address}. Bij het kiezen van medewerkers staan de kilometers bij elke kandidaat; de kaart is om op het oog te kiezen.',
  'Hide map': 'Kaart verbergen',
  'Show on map': 'Op de kaart tonen',
  'Could not load the saved schedule': 'De opgeslagen planning kon niet worden geladen',
  'Loading saved schedule': 'Opgeslagen planning laden',
  'Nobody is standing on this vacancy — people are added to individual days below.':
    'Niemand staat vast op deze vacature — medewerkers worden hieronder per dag toegevoegd.',
  Replace: 'Vervangen',
  End: 'Beëindigen',
  'Schedule changes were not saved:': 'Wijzigingen in de planning zijn niet opgeslagen:',
  'Retry save': 'Opnieuw opslaan',
  'Schedule saves automatically': 'De planning wordt automatisch opgeslagen',
  Day: 'Dag',
  Week: 'Week',
  Month: 'Maand',
  Back: 'Terug',
  Forward: 'Vooruit',
  'The selected date may not persist in this browser:':
    'De gekozen datum wordt in deze browser mogelijk niet onthouden:',
  'Remove slot': 'Plek verwijderen',
  extra: 'extra',
  cover: 'vervanging',
  'Move up': 'Omhoog',
  'Move down': 'Omlaag',
  'Beyond the client order — worked, not billed':
    'Buiten de bestelling van de klant — gewerkt, niet gefactureerd',
  'Add people': 'Medewerkers toevoegen',
  'Who can work': 'Wie kan werken',
  'With car only': 'Alleen met auto',
  'For strike days.': 'Voor stakingsdagen.',
  'Nobody holds this contract': 'Niemand heeft toegang tot deze klant',
  'No active worker has access to this client.':
    'Geen enkele actieve medewerker heeft toegang tot deze klant.',
  'Show available only': 'Alleen beschikbaren tonen',
  'Show everyone · {count} hidden': 'Iedereen tonen · {count} verborgen',
  'Show everyone': 'Iedereen tonen',
  'Nobody here has a car': 'Niemand hier heeft een auto',
  'Switch the filter off to see everyone who holds this contract.':
    'Zet het filter uit om iedereen met toegang tot deze klant te zien.',
  'no travel on record': 'geen reisafstand bekend',
  ' · already on this job today': ' · werkt vandaag al hier',
  ' · no car — this site needs one': ' · geen auto — deze locatie vereist er een',
  ' · at a course this weekday': ' · heeft deze weekdag cursus',
  ' · on leave': ' · afwezig',
  ' · free': ' · vrij',
  ' · car': ' · auto',
  ' · no car': ' · geen auto',
  ' · car status unverified': ' · auto niet gecontroleerd',
  ' · hidden from selection': ' · verborgen bij selectie',
  'Show this day': 'Deze dag tonen',
  'Remove from hidden': 'Niet meer verbergen',
  Hide: 'Verbergen',
  Declined: 'Afgewezen',
  Assign: 'Inplannen',
  'On site beyond the client order — worked, not billed':
    'Ter plaatse buiten de bestelling van de klant — gewerkt, niet gefactureerd',
  '+ extra': '+ extra',
  'Download PNG': 'PNG downloaden',
  'Replace {name}': '{name} vervangen',
  'Only the days in the range change. The standing arrangement stays, so {name} returns by itself afterwards.':
    'Alleen de dagen in deze periode veranderen. De vaste afspraak blijft, dus {name} komt daarna vanzelf terug.',
  From: 'Van',
  Until: 'Tot en met',
  'Reason (optional)': 'Reden (optioneel)',
  'Sick, holiday…': 'Ziek, vakantie…',
  'One day — only the working days of this arrangement ({weekdays}) are touched, {touched} in this range.':
    'Eén dag — alleen de werkdagen van deze afspraak ({weekdays}) veranderen, {touched} in deze periode.',
  '{days} days — only the working days of this arrangement ({weekdays}) are touched, {touched} in this range.':
    '{days} dagen — alleen de werkdagen van deze afspraak ({weekdays}) veranderen, {touched} in deze periode.',
  'Nobody else holds this contract': 'Niemand anders heeft toegang tot deze klant',
  'No car': 'Geen auto',
  'Does not meet requirements': 'Voldoet niet aan de eisen',
  Unavailable: 'Niet beschikbaar',
  'Add a standing person': 'Vaste medewerker toevoegen',
  'Judged over {count} working days up to {date}.': 'Beoordeeld over {count} werkdagen tot {date}.',
  'Judged over {count} working days — the next four weeks, since this vacancy has no end date.':
    'Beoordeeld over {count} werkdagen — de komende vier weken, omdat deze vacature geen einddatum heeft.',
  Busy: 'Bezet',
  Place: 'Locatie',
  'Whole site': 'Hele locatie',
  'Section (optional)': 'Afdeling (optioneel)',
  'Inbound…': 'Inbound…',
  'The chosen days are filled in straight away; days that already have somebody are left alone. Each day stays an ordinary shift afterwards, so one of them can be swapped without touching the arrangement.':
    'De gekozen dagen worden direct ingevuld; dagen waarop al iemand staat blijven ongemoeid. Elke dag blijft daarna een gewone dienst, zodat je er één kunt ruilen zonder de afspraak te wijzigen.',
  'Order people on {date}': 'Medewerkers bestellen op {date}',
  'Whole site — no place': 'Hele locatie — geen hal',
  'Inbound, Outbound…': 'Inbound, Outbound…',
  'A section is only written when the client asks for one. Conakryweg is ordered with none, and that is normal.':
    'Een afdeling wordt alleen ingevuld als de klant erom vraagt. Conakryweg wordt zonder afdeling besteld, en dat is normaal.',
  'Start time': 'Begintijd',
  'No end time on this job — people leave when the work is done, so the rest of the day stays blocked for them.':
    'Geen eindtijd bij dit werk — medewerkers gaan weg als het werk klaar is, dus de rest van de dag blijven ze geblokkeerd.',
  'Nothing to share yet': 'Nog niets om te delen',
  'No days in this view have anybody ordered on them.':
    'Op geen enkele dag in deze weergave is iemand besteld.',
  '— nobody yet —': '— nog niemand —',
  'Everything fits one screenshot — the preview will not crop the last name. * = beyond the client order.':
    'Alles past op één schermafbeelding — de voorvertoning snijdt de laatste naam niet af. * = buiten de bestelling van de klant.',
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

  const value = useMemo<LanguageContextValue>(
    () => ({
      locale,
      setLocale,
      t: (message, values = {}) => {
        const translated = locale === 'nl' ? (dutch[message] ?? message) : message
        return translated.replace(/\{(\w+)\}/g, (match, key: string) =>
          key in values ? String(values[key]) : match,
        )
      },
    }),
    [locale],
  )

  return <LanguageContext.Provider value={value}>{children}</LanguageContext.Provider>
}

export function useLanguage(): LanguageContextValue {
  const context = useContext(LanguageContext)
  if (!context) throw new Error('LanguageProvider is missing.')
  return context
}

export function LanguageSwitcher() {
  const { locale, setLocale, t } = useLanguage()
  return (
    <div className="locale-switch" role="group" aria-label={t('Language')}>
      <span>{t('Language')}</span>
      <button
        type="button"
        aria-label={t('Switch language to English')}
        aria-pressed={locale === 'en'}
        className={locale === 'en' ? 'active' : ''}
        onClick={() => setLocale('en')}
      >
        EN
      </button>
      <button
        type="button"
        aria-label={t('Switch language to Dutch')}
        aria-pressed={locale === 'nl'}
        className={locale === 'nl' ? 'active' : ''}
        onClick={() => setLocale('nl')}
      >
        NL
      </button>
    </div>
  )
}
