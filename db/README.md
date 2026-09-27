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

## Imported Warehouse snapshot

The supplied CSV export has been loaded into the local database: 33 workers,
52 absence periods, and 537 Warehouse shifts. Source IDs, dates, hours, worker
links, sites, notes, and absence reasons are retained. The weekly course-day
index is rebuilt from each worker's `fixed_course_days`; worker home addresses
remain empty. The CSV files contain personal data and are intentionally not
stored in this repository.

## Main tables

| Table | Purpose |
| --- | --- |
| `worker` | Stable local worker identity, active/fired state, language/notes and weekly course-day source data. `flexpedia_id` is nullable and unique; a future sync maps API records onto the existing worker row and never replaces the local key, so its historical shifts remain linked. Home addresses are optional and are not imported. |
| `absence` | Date ranges when a worker is unavailable. |
| `company`, `site` | Clients and physical locations, including Warehouse halls. |
| `vacancy`, `vacancy_site` | The job/order and the sites where it can be staffed. |
| `vacancy_requirement` | Required or preferred skills, language, documents, transport and availability conditions. |
| `vacancy_demand` | Dated headcount/time requirements. |
| `shift` | Assigned or uncovered shift occurrence, hours, planned/actual times, confirmation, attendance and replacement link. |
| `vacancy_schedule_state` | Per-vacancy schedule revision, standing assignments, and candidate offer/decline decisions. |
| `shift_offer` | Offer/response history per candidate and shift. |
| `manual_hours` | Per-worker, vacancy, and date overrides for manually entered time; imported shift hours remain unchanged. |
| `worker_course_day`, `worker_qualification`, `worker_company_access` | Normalized recurring availability and candidate-fit data. |
| `vacancy_change` | Auditable vacancy change history. |
| `app_user` | Login credentials and a session version incremented on password changes to revoke all previously issued tokens. |
| `auth_login_attempt` | Short-lived sign-in throttling keyed by an HMAC of the client IP, not the raw IP. |
| `travel_distances`, `geocode_cache` | Optional route history and address lookup cache. |

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
times and attendance are left unknown rather than inferred. Workers' addresses
are not required for planning and are not populated by this migration.

## Deployment and personal data

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
