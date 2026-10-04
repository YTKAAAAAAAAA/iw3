#!/bin/sh
# Daily backup of the dispatcher database and workday photos.
#
# Every dump is restored into a scratch database before it counts as a
# backup: a dump that cannot be restored is not a backup. Archives older
# than BACKUP_KEEP_DAYS are removed. /backups/LAST_SUCCESS and LAST_FAILURE
# record the outcome; BACKUP_PING_URL (e.g. a healthchecks.io check) is
# called after every success so a missed backup raises an alert.
set -u

BACKUP_AT="${BACKUP_AT:-03:30}"
KEEP_DAYS="${BACKUP_KEEP_DAYS:-14}"

backup() (
  set -eu
  stamp=$(date -u +%Y-%m-%dT%H%M%SZ)
  dump="/backups/dispatcher-$stamp.dump"
  pg_dump --format=custom --file="$dump.partial" "$PGDATABASE"
  mv "$dump.partial" "$dump"

  dropdb --if-exists restore_check
  createdb restore_check
  pg_restore --dbname=restore_check --no-owner --no-privileges --exit-on-error "$dump"
  workers=$(psql -d restore_check -tAc 'SELECT count(*) FROM worker')
  migrations=$(psql -d restore_check -tAc 'SELECT count(*) FROM schema_migrations')
  dropdb restore_check

  tar -czf "/backups/photos-$stamp.tar.gz.partial" -C /photos .
  mv "/backups/photos-$stamp.tar.gz.partial" "/backups/photos-$stamp.tar.gz"

  find /backups -maxdepth 1 \( -name 'dispatcher-*.dump' -o -name 'photos-*.tar.gz' \) -mtime +"$KEEP_DAYS" -delete
  echo "$stamp restored and verified: $workers workers, $migrations migrations" > /backups/LAST_SUCCESS
  echo "Backup $stamp verified ($workers workers)."
  if [ -n "${BACKUP_PING_URL:-}" ]; then wget -qO- "$BACKUP_PING_URL" > /dev/null || true; fi
)

seconds_until_next_run() {
  now=$(date +%s)
  next=$(date -d "$(date +%Y-%m-%d) $BACKUP_AT" +%s)
  [ "$next" -le "$now" ] && next=$((next + 86400))
  echo $((next - now))
}

while true; do
  sleep "$(seconds_until_next_run)"
  if ! backup; then
    echo "$(date -u +%Y-%m-%dT%H%M%SZ) backup FAILED" | tee /backups/LAST_FAILURE
  fi
done
