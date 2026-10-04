# Local Docker and deployment

The stack is three containers from `compose.yaml`:

| Service | What it does |
| --- | --- |
| `postgres` | PostgreSQL 17 on a private, internal network with no published port. |
| `app` | The dispatcher (Next.js standalone server). Runs the schema migrations on every start, then serves on `127.0.0.1:3000`. Read-only filesystem; workday photos live in the `photos_data` volume. Docker healthcheck: `/api/health`. |
| `backup` | Daily `pg_dump` and photo archive into `./backups`, each dump verified by a test restore. |

The app syncs Flexpedia employees and the Supabase Warehouse snapshot every
hour on its own (`SYNC_INTERVAL_MINUTES`, default 60, `0` turns it off) and
then recalculates road distances for changed addresses. Both sources can also
be synced by hand on **Sync sources** or with the sync button in the header.

## Start locally

1. Start Docker Desktop and copy `.env.example` to `.env`.
2. Set distinct, random values for `POSTGRES_SUPERUSER_PASSWORD`,
   `APP_DB_PASSWORD` and `SESSION_SECRET` (at least 32 bytes), and a unique
   `INITIAL_ADMIN_PASSWORD` of at least 12 characters. In PowerShell:

   ```powershell
   $bytes = [byte[]]::new(32)
   [Security.Cryptography.RandomNumberGenerator]::Fill($bytes)
   -join ($bytes | ForEach-Object { $_.ToString('x2') })
   ```

   Generate a different value for every secret and paste them only into `.env`.
   Optionally set `SUPABASE_DATABASE_URL` (see below) and `FLEXPEDIA_API_TOKEN`.
3. Build and start everything:

   ```sh
   docker compose up -d --build
   ```

4. Open <http://localhost:3000> and sign in with `INITIAL_ADMIN_PASSWORD`.
   That first sign-in creates the account; afterwards only the account's own
   password works. Remove `INITIAL_ADMIN_PASSWORD` from `.env` and change the
   password under **Change password**.

Updating is the same command: `docker compose up -d --build`. Migrations are
idempotent and take an advisory lock, so they are safe on every start. To run
them by hand: `docker compose run --rm app node scripts/migrate.mjs`.

## Vercel frontend and VPS backend

The Vercel deployment serves the pages. Its `/api/*` requests (see
`vercel.json`) and its server-rendered data go to the VPS over HTTPS. The
database is never exposed to Vercel or the internet.

On the VPS, bind the app to `127.0.0.1:3001` with the override file:

```sh
docker compose -f compose.yaml -f compose.server.yaml up -d --build
```

Add this route inside the `api.iatw-backend.site` Caddy site block, **before**
its existing `reverse_proxy` directive, then validate and reload Caddy:

```caddy
handle_path /dispatcher-api/* {
    reverse_proxy 127.0.0.1:3001
}
```

```sh
caddy validate --config /etc/caddy/Caddyfile && caddy reload --config /etc/caddy/Caddyfile
```

Check it from outside: `curl https://api.iatw-backend.site/dispatcher-api/api/health`
must answer `{"status":"ok",…}`. A `{"detail":"Not Found"}` answer comes from
the other backend on that host and means the route above is missing or below
the catch-all `reverse_proxy`; a 502 means the app container is not running.

Create a Vercel project from this repository's `master` branch. Set in Vercel
(Production and Preview):

- `APP_BACKEND_URL=https://api.iatw-backend.site/dispatcher-api`
- `BACKEND_PROXY_SECRET` — the same random secret on Vercel and the VPS; it
  restricts password sign-in requests to the Vercel server action.
- `SESSION_SECRET` — exactly the same secret as on the VPS.
- `INITIAL_ADMIN_EMAIL` — the same value as on the VPS.

Do not set `DATABASE_URL` on Vercel. Automatic sync only runs on the VPS.

## Supabase: read-only access

The Warehouse sync reads `public.workers`, `public.schedule` and
`public.vacations` inside a read-only transaction. Give it a role that cannot
write anything even if the app is compromised, instead of the `postgres` user.
In the Supabase SQL editor:

```sql
CREATE ROLE iatw_reader LOGIN PASSWORD '<a long random password>' BYPASSRLS;
GRANT USAGE ON SCHEMA public TO iatw_reader;
GRANT SELECT ON public.workers, public.schedule, public.vacations TO iatw_reader;
ALTER ROLE iatw_reader SET default_transaction_read_only = on;
```

`BYPASSRLS` is needed because those tables have row-level security; the role
can still only read the three tables. Then use the pooler connection string
with `iatw_reader.<project-ref>` as the user in `SUPABASE_DATABASE_URL`.

The sync refuses a snapshot that would delete all, or more than half, of the
imported shifts or absences at once, and changes nothing in that case.

## Travel distances and privacy

Worker home addresses come from Flexpedia. Each new address is geocoded once
(PDOK Locatieserver, the Dutch address register; Nominatim as fallback) and
cached. Road distances to every open vacancy are computed with OSRM
(`ROUTING_BASE_URL`) and stored per address pair; a pair is only recomputed
when one of its addresses changes. Old distances are closed, not overwritten,
so past travel compensation stays reproducible.

This sends home addresses to PDOK/Nominatim and coordinates to the routing
server. The default public OSRM server is a fair-use demo; for production with
real addresses, self-host OSRM with the Netherlands extract (about 2 GB RAM)
and point `ROUTING_BASE_URL` at it, so no coordinates leave your server.

## Backups and monitoring

- `./backups` holds `dispatcher-<time>.dump` and `photos-<time>.tar.gz` for
  `BACKUP_KEEP_DAYS` days. `LAST_SUCCESS` names the last verified backup,
  `LAST_FAILURE` the last failed one. Copy the directory off the server
  (for example with restic or rclone): a backup on the same disk does not
  survive losing that disk.
- Set `BACKUP_PING_URL` to a dead-man switch (e.g. healthchecks.io) to be
  alerted when a daily backup does not happen.
- Point an uptime monitor at `https://…/dispatcher-api/api/health`: HTTP 200
  means the database answers; `"sync":"stale"` means automatic sync has not
  succeeded for three intervals.
- Restore: `docker compose exec -T postgres pg_restore -U postgres -d dispatcher --clean --if-exists < backups/dispatcher-<time>.dump`
  and unpack the matching photo archive into the `photos_data` volume.

## Credentials and real records

Never put credentials in `NEXT_PUBLIC_*`, source files, command output, Git,
or deployment artifacts. To recover a lost password, reset it on the server;
this signs out every session:

```sh
docker compose exec -e ADMIN_NEW_PASSWORD='<new password>' app node scripts/reset-admin-password.mjs
```

The `postgres_data` and `photos_data` volumes persist across restarts. A
Docker volume is persistent storage, not a backup and not encryption: keep
the off-site backups, restrict SSH and Docker access, and keep the host
firewall closed except for the reverse proxy.
