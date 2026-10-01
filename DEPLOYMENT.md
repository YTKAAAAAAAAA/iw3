# Local Docker and deployment

The app and PostgreSQL can run locally in Docker. PostgreSQL is on a private,
internal Compose network with no published host port; only the app can connect.
The app itself is published on `127.0.0.1:3000`, not on the local network.

## Vercel frontend and VPS backend

The Vercel deployment serves the Next.js interface. Its `/api/*` requests and
server-rendered workforce data go to the API on the VPS over HTTPS. The
PostgreSQL container remains on a private Docker network and is never exposed
to Vercel or the public internet.

The VPS uses a separate Compose override to bind the app to
`127.0.0.1:3001`; it does not publish a database port:

```sh
docker compose -f compose.yaml -f compose.server.yaml up -d postgres
docker compose -f compose.yaml -f compose.server.yaml build app
docker compose -f compose.yaml -f compose.server.yaml run --rm app npm run db:migrate
docker compose -f compose.yaml -f compose.server.yaml up -d app
```

Add this route inside the existing `api.iatw-backend.site` Caddy site block,
before its existing `reverse_proxy` directive. Validate the Caddyfile before
reloading Caddy. The path is reserved for this app; the existing backend's
routes continue to use their existing upstream:

```caddy
handle_path /dispatcher-api/api/* {
    reverse_proxy 127.0.0.1:3001
}
```

Create a new Vercel project from the repository's `master` branch; do not
replace the existing Vercel projects. Set these Vercel **Production** and
**Preview** environment variables:

- `APP_BACKEND_URL=https://api.iatw-backend.site/dispatcher-api`
- `BACKEND_PROXY_SECRET` — the same random secret on Vercel and the VPS; it
  restricts password sign-in requests to the Vercel server action.
- `SESSION_SECRET` — exactly the same random secret configured on the VPS.
- `INITIAL_ADMIN_EMAIL` — the same administrator email as the VPS.

On the VPS, set `BACKEND_PROXY_SECRET`, `SESSION_SECRET`, `INITIAL_ADMIN_EMAIL`, and
`INITIAL_ADMIN_PASSWORD` in its private `.env`, along with separate
`POSTGRES_SUPERUSER_PASSWORD` and `APP_DB_PASSWORD` secrets. The Vercel
project never receives database credentials. Browser API calls use same-origin
Vercel rewrites; server-rendered pages make authenticated HTTPS requests to the
backend. Do not set `DATABASE_URL` on Vercel.

## Start locally

1. Start Docker Desktop and copy `.env.example` to `.env`.
2. Set distinct, random values for `POSTGRES_SUPERUSER_PASSWORD`,
   `APP_DB_PASSWORD`, and `SESSION_SECRET` (at least 32 bytes). Set
   `INITIAL_ADMIN_PASSWORD` to a unique password of at least 12 characters.
   Hex-encoded random values work well for the database passwords. For
   example, in PowerShell generate a fresh value with:

   ```powershell
   $bytes = [byte[]]::new(32)
   [Security.Cryptography.RandomNumberGenerator]::Fill($bytes)
   -join ($bytes | ForEach-Object { $_.ToString('x2') })
   ```

   Generate a different value for every secret and paste them only into `.env`.
   Keep `.env` out of Git.
3. Start PostgreSQL and wait until it is healthy:

   ```sh
   docker compose up -d postgres
   ```

4. Build the app image and apply schema migrations:

   ```sh
   docker compose build app
   docker compose run --rm app npm run db:migrate
   ```

5. Start the site at <http://localhost:3000>:

   ```sh
   docker compose up -d app
   ```

The named `postgres_data` volume persists the database across container
restarts. The image creates a non-superuser `dispatcher` role for the app;
only the PostgreSQL superuser initializes the database. `POSTGRES_HOST_AUTH_METHOD`
and `POSTGRES_INITDB_ARGS` require SCRAM-SHA-256 password authentication.

The database is not published to the host, and the database network is marked
internal. The UI/API is the only service attached to both that network and the
outbound app network. Docker MFA is not a PostgreSQL feature: database
connections use the app's service credential, not an interactive login. MFA
can be added to human sign-in separately if required.

## VPS

On a VPS, keep PostgreSQL on the same private Docker network with no `ports`
mapping. Publish the app only through a TLS-terminating reverse proxy, and
restrict host firewall ingress to the proxy's required ports. Use a unique
`.env` on the server, restrict SSH and Docker-daemon access, encrypt backups,
and test restoring them. A Docker volume is persistent storage, not a backup
or at-rest encryption.

Do not expose PostgreSQL directly to Vercel or the public internet. For this
deployment, Vercel talks only to the VPS API over HTTPS; PostgreSQL is reachable
only by the backend app over its private Docker network.

## Credentials and real records

Never put credentials in `NEXT_PUBLIC_*`, source files, command output, Git,
or deployment artifacts. The first successful login creates the dispatcher
account using `INITIAL_ADMIN_EMAIL` and `INITIAL_ADMIN_PASSWORD`. If the
account already exists, the configured initial password can reset its
password at sign-in. After signing in, remove `INITIAL_ADMIN_PASSWORD` from
the deployment environment and keep `INITIAL_ADMIN_EMAIL` unchanged.

The existing local PostgreSQL database contains real worker, absence, and
shift data. The Compose database starts empty; its schema migrations do not
seed or transfer records. Back up and transfer only required business tables
through an encrypted, access-controlled process after confirming the VPS and
data-processing arrangement are approved. Exclude local account and
migration metadata. Never put an unencrypted dump in the repository or image.

Workday photos are stored as private PostgreSQL `BYTEA` data. Listing,
uploading, viewing, and deleting them require an authenticated session; only
JPEG, PNG, and WebP content is accepted, up to 10 MiB per photo. They are not
included in the share/screenshot view.
