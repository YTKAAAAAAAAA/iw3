# Local Docker and deployment

The app and PostgreSQL can run locally in Docker. PostgreSQL is on a private,
internal Compose network with no published host port; only the app can connect.
The app itself is published on `127.0.0.1:3000`, not on the local network.

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

Do not point a public Vercel deployment at a PostgreSQL container on a
developer laptop. A Vercel deployment instead needs a separately approved,
managed PostgreSQL database with TLS and a pooled connection string.

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
