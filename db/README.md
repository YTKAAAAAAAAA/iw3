# PostgreSQL data model

The database keeps the real worker, absence, and Warehouse shift rows. A
Warehouse vacancy owns the existing shifts; Slego and Conakryweg remain its
separate work sites. The migration is additive: it links the existing rows
without changing their dates, hours, workers, or locations.

## Apply schema changes

Set `DATABASE_URL` to the target PostgreSQL connection string and run:

```sh
npm run db:migrate
```

The migration runner takes a PostgreSQL advisory lock and records applied
migrations in `schema_migrations`. It does not seed or overwrite worker data.

## Warehouse snapshot synchronization

The current Warehouse snapshot is stored in Supabase tables `workers`,
`schedule`, and `vacations`. **Sync sources** reads a consistent, read-only
snapshot and synchronizes worker profiles by stable worker IDs, and shifts and
absences by stable record IDs, in one local transaction. Source shifts and
absences removed from Supabase are removed locally; shift offers attached to a
removed shift are removed as well. Schedule fields on linked shifts are updated
from Supabase even if they were changed locally. Local-only shifts and absences
are not treated as source records and remain untouched. Flexpedia owns the
name of every worker linked to it; Supabase only names workers that are not
linked to Flexpedia yet. Exact-name matching is
used only to link older local worker rows that do not yet have a Supabase ID;
ambiguous matches stop the entire sync. A snapshot that would delete all, or
more than half, of the imported shifts or absences is refused as a broken
source and changes nothing.

Disabling Supabase sync only stops future snapshots. The separate Flexpedia
employee sync reads the complete paginated employee list, matches by stable ID
or a unique exact name, and creates unmatched workers without company access.
Profile fields from Flexpedia are authoritative: incoming values, including
nulls, replace the stored Flexpedia profile. Employment status is managed
manually in the dispatcher; Flexpedia sync never dismisses or reactivates
workers, regardless of whether they appear in its employee snapshot. Manual
dismissal and restoration preserve the local worker row, shifts, absences,
hours, and work history. The connection test remains read-only. The documented
EmployeeModel contains `id`, initials,
first/insertion/last name, gender, birthdate, street, street number/addition,
postcode, city, phone, phone-country ISO code, mobile, email, residence-country
ISO code, and nationality ISO code. Only initials, first name, last name, and
email are required by the OpenAPI schema; most profile fields are nullable or
optional. The isolated merge fixture exercises all 18 schema fields against
one uniquely matched local worker and one fake new worker, but does not write
either record. Flexpedia's documented endpoint does not provide schedules.

## Main tables

| Table | Purpose |
| --- | --- |
| `worker` | Stable local worker identity, manually managed active/fired state and dismissal date, language/notes and weekly course-day source data. `flexpedia_id` is nullable and unique; Flexpedia sync maps API records onto the existing worker row and never replaces the local key, so its historical shifts remain linked. Flexpedia address fields are stored for the profile but are not shown in the workforce interface. |
| `absence` | Date ranges when a worker is unavailable. |
| `company`, `site` | Clients and physical locations, including Warehouse halls. |
| `vacancy`, `vacancy_site` | The job/order and the sites where it can be staffed. |
| `vacancy_requirement` | Required or preferred skills, language, documents, transport and availability conditions. |
| `vacancy_demand` | Dated headcount/time requirements. |
| `shift` | Assigned or uncovered shift occurrence, hours, planned/actual times, confirmation, attendance and replacement link. |
| `vacancy_schedule_state` | Per-vacancy schedule revision, standing assignments, and candidate offer/decline decisions. |
| `vacancy_workday_photo` | Metadata of private JPEG/PNG/WebP photos attached to a vacancy and work date. The image itself is a file in `PHOTO_STORAGE_DIR` named by `storage_key`; `image` (BYTEA) only remains for rows not yet moved by `scripts/migrate.mjs`. |
| `shift_offer` | Offer/response history per candidate and shift. |
| `manual_hours` | Per-worker, vacancy, and date overrides for manually entered time; imported shift hours remain unchanged. |
| `worker_course_day`, `worker_qualification`, `worker_company_access` | Normalized recurring availability and candidate-fit data. |
| `vacancy_change` | Auditable vacancy change history. |
| `app_user` | Login credentials and a session version incremented on password changes to revoke all previously issued tokens. |
| `auth_login_attempt` | Short-lived sign-in throttling keyed by an HMAC of the client IP, not the raw IP. |
| `travel_distances`, `geocode_cache` | Road distance per worker address × vacancy address, frozen and superseded rather than overwritten, and the address → coordinates cache. Filled hourly by `lib/travel/refresh.ts` from `travel_recompute_queue`. |
| `warehouse_sync_control`, `flexpedia_sync_control` | Per-source switch, last success, last attempt and last error; the hourly scheduler syncs a source when its last attempt is older than `SYNC_INTERVAL_MINUTES`. |

## Vacancy schedule persistence

`PUT /api/vacancies/{slug}/schedule` accepts an authenticated, vacancy-scoped
snapshot/diff with `revision`, `demand`, `roster`, `standing`,
`deleteDemandIds`, and `deleteRosterIds`. Existing numeric row IDs can only
update rows already owned by that vacancy; nonnumeric client IDs create rows.
The response returns the incremented revision, `ids.demand` and `ids.roster`
maps from client IDs to database IDs, and `cancelledShiftIds`.
`GET` returns the active schedule and the revision to use on the next save.

The vacancy row and its revision are locked in a serializable transaction.
Stale revisions are rejected with 409. Existing shift hours and actual-time
fields are never rewritten; planned times use `scheduled_start` and
`scheduled_end`. Newly assigned or changed workers must be active, not fired,
and have access to the vacancy's company; unchanged historical assignments
remain intact. Removing a shift with offers marks it cancelled and retains the
shift and offer records; removing one without offers deletes only that
explicitly addressed shift. Schedule state stores standing assignments and
candidate responses as vacancy-scoped JSON and every save is recorded in
`vacancy_change`.

The existing `shift.hours` values are retained as entered; missing scheduled
times and attendance are left unknown rather than inferred. Schema migrations
do not populate worker addresses; the Flexpedia employee sync updates the
stored address from its source.

## Deployment and personal data

For local use, run PostgreSQL using the root `compose.yaml`; its container is
reachable only from the app over an internal Docker network, with no published
database port. See [DEPLOYMENT.md](../DEPLOYMENT.md) for setup and VPS notes.
Use a managed PostgreSQL service with TLS and connection pooling for Vercel.
The live local database contains real worker data. Do not put a SQL dump, the
local PostgreSQL data directory, connection strings, or worker CSV exports in
Git. Before copying those records to a hosting provider, confirm that the
provider and data-processing arrangement are approved; migrate the schema
first, then use an encrypted, access-controlled transfer. Do not copy local
`app_user` rows or session/password hashes to the preview database.

The workforce directory, worker profiles, shift/hour list, time-off list,
vacancies, company view, and search read live records from PostgreSQL.
Authenticated edits to worker notes, company access, own-car/VOG status,
recurring course days, dated absences, company details, manual hours, and
vacancy details and requirements are persisted. Dated demand, shift assignments, standing assignments, and candidate
offer/decline decisions are saved with revision checks; shift history, offers,
attendance, and actual times are protected from destructive edits. Worker
identity and contact fields remain read-only. The app
intentionally does not show worker home addresses.

Workday photos are attached to a vacancy and date, stored as PostgreSQL binary
data, and exposed only through authenticated API routes. Share view does not
include the photo report.
