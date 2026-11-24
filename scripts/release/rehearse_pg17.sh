#!/usr/bin/env bash
# Disposable CI rehearsal only. Never execute against Oracle or operator databases.
set -euo pipefail

[[ "${GITHUB_ACTIONS:-}" == true && "${CI:-}" == true ]] || {
  echo 'This rehearsal requires a GitHub-hosted CI job.' >&2
  exit 1
}
[[ "${PG_CONTAINER:-}" =~ ^[0-9a-f]{12,64}$ ]] || {
  echo 'Missing disposable service container ID.' >&2
  exit 1
}
[[ "$(docker inspect --format '{{.Config.Image}}' "$PG_CONTAINER")" == postgres:17 ]]
[[ "$(docker exec "$PG_CONTAINER" postgres --version)" == *" 17."* ]]
[[ "${BASE_SHA:-}" =~ ^[0-9a-f]{40}$ && "${SOURCE_SHA:-}" =~ ^[0-9a-f]{40}$ ]]
[[ "${GITHUB_SHA:-}" == "$SOURCE_SHA" ]]

umask 077
tmp=$(mktemp -d "${RUNNER_TEMP:?}/azm-release-rehearsal.XXXXXX")
trap 'rm -rf -- "$tmp"' EXIT
repo=$(git rev-parse --show-toplevel)
prisma="$repo/backend/node_modules/.bin/prisma"
test -x "$prisma"

# Fixed, disposable CI identities. No production URL or credential input.
fixture=azm_release_fixture
restore=azm_release_restore
dburl() { printf 'postgresql://postgres:synthetic_release_only@127.0.0.1:5432/%s' "$1"; }
sql() { docker exec -i "$PG_CONTAINER" psql -X -v ON_ERROR_STOP=1 -U postgres -d "$1" "${@:2}"; }
migrate() {
  local database="$1" schema="$2"
  DATABASE_URL="$(dburl "$database")" DIRECT_URL="$(dburl "$database")" \
    "$prisma" migrate deploy --schema "$schema"
}
status() {
  local database="$1" schema="$2"
  DATABASE_URL="$(dburl "$database")" DIRECT_URL="$(dburl "$database")" \
    "$prisma" migrate status --schema "$schema"
}
snapshot() {
  sql "$1" -At -c 'SELECT id || chr(58) || marks FROM release_rehearsal_fixture.sample ORDER BY id'
}

# Establish the actual base migration chain from the exact reviewed Git tree.
git -C "$repo" archive "$BASE_SHA" backend/prisma | tar -xf - -C "$tmp"
sql postgres -c "CREATE DATABASE $fixture"
sql postgres -c "CREATE DATABASE $restore"
migrate "$fixture" "$tmp/backend/prisma/schema.prisma"
status "$fixture" "$tmp/backend/prisma/schema.prisma"
sql "$fixture" <<'SQL'
CREATE SCHEMA release_rehearsal_fixture;
CREATE TABLE release_rehearsal_fixture.sample (id text PRIMARY KEY, marks integer NOT NULL);
INSERT INTO release_rehearsal_fixture.sample VALUES ('synthetic-a', 71), ('synthetic-b', 95);
SQL
snapshot "$fixture" > "$tmp/before.txt"

# The dump is synthetic and remains on the disposable runner.
docker exec "$PG_CONTAINER" pg_dump -U postgres -Fc "$fixture" > "$tmp/fixture.dump"
test -s "$tmp/fixture.dump"
sha256sum "$tmp/fixture.dump"
docker exec -i "$PG_CONTAINER" pg_restore --list < "$tmp/fixture.dump" > "$tmp/archive-list.txt"
test -s "$tmp/archive-list.txt"
docker exec -i "$PG_CONTAINER" pg_restore -U postgres -d "$restore" \
  --exit-on-error --single-transaction < "$tmp/fixture.dump"
snapshot "$restore" > "$tmp/restored.txt"
cmp "$tmp/before.txt" "$tmp/restored.txt"

# Exercise the candidate's real migration files on the restored clone.
migrate "$restore" "$repo/backend/prisma/schema.prisma"
status "$restore" "$repo/backend/prisma/schema.prisma"
snapshot "$restore" > "$tmp/after.txt"
cmp "$tmp/before.txt" "$tmp/after.txt"

# Exercise a pending additive migration even in an infrastructure-only PR.
# This probe is never part of the repository's real migration history.
mkdir -p "$tmp/probe"
cp -a "$repo/backend/prisma/." "$tmp/probe/"
probe="$tmp/probe/migrations/99991231235959_synthetic_release_probe"
mkdir "$probe"
printf '%s\n' "ALTER TABLE release_rehearsal_fixture.sample ADD COLUMN proof text NOT NULL DEFAULT 'verified';" > "$probe/migration.sql"
migrate "$restore" "$tmp/probe/schema.prisma"
status "$restore" "$tmp/probe/schema.prisma"
[[ "$(sql "$restore" -At -c "SELECT count(*) FROM release_rehearsal_fixture.sample WHERE proof='verified'")" == 2 ]]
snapshot "$restore" > "$tmp/after-probe.txt"
cmp "$tmp/before.txt" "$tmp/after-probe.txt"
snapshot "$fixture" > "$tmp/original.txt"
cmp "$tmp/before.txt" "$tmp/original.txt"
[[ "$(sql "$fixture" -At -c "SELECT count(*) FROM information_schema.columns WHERE table_schema='release_rehearsal_fixture' AND table_name='sample' AND column_name='proof'")" == 0 ]]
echo 'PASS: actual base/candidate migration chains, synthetic backup/restore, additive migration and unchanged source fixture.'
