#!/usr/bin/env bash
set -euo pipefail
umask 077

script_dir="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
project_dir="$(cd "$script_dir/.." && pwd)"
env_args=()
output=""

usage() {
  echo 'Usage: bash infra/backup-database.sh --env-file PATH [--env-file PATH ...] --output /private/path/database.dump' >&2
}

while [ "$#" -gt 0 ]; do
  case "$1" in
    --env-file|--output)
      if [ "$#" -lt 2 ] || [ -z "$2" ]; then usage; exit 2; fi
      if [ "$1" = --env-file ]; then
        if [ ! -f "$2" ]; then echo 'Env file not found' >&2; exit 2; fi
        env_args+=(--env-file "$2")
      else
        if [ -n "$output" ]; then echo 'Specify --output once' >&2; exit 2; fi
        output="$2"
      fi
      shift 2
      ;;
    -h|--help) usage; exit 0 ;;
    *) usage; exit 2 ;;
  esac
done

if [ "${#env_args[@]}" -eq 0 ] || [[ "$output" != /* ]] || [[ "$output" == *$'\n'* ]]; then
  usage
  exit 2
fi
if [ -e "$output" ] || [ -L "$output" ]; then
  echo 'Backup destination already exists; refusing to overwrite' >&2
  exit 1
fi

output_dir="$(dirname "$output")"
mkdir -p "$output_dir"
partial="$(mktemp "$output_dir/.database-backup.XXXXXX")"
trap 'rm -f "$partial"' EXIT
trap 'exit 129' HUP
trap 'exit 130' INT
trap 'exit 143' TERM
compose=(docker compose "${env_args[@]}" -f "$project_dir/docker-compose.prod.yml")

# Read the matching PostgreSQL client and credentials inside the running service.
# No host DATABASE_URL/password is expanded, sourced, or passed on the command line.
"${compose[@]}" exec -T postgres sh -ec '
  PGPASSWORD="$POSTGRES_PASSWORD" exec pg_dump --no-password --format=custom \
    --no-owner --no-privileges --lock-wait-timeout=60s \
    --username="$POSTGRES_USER" --dbname="$POSTGRES_DB"
' > "$partial"
test -s "$partial"
# Read and decompress the entire archive without executing its SQL or connecting.
"${compose[@]}" exec -T postgres pg_restore --file=/dev/null < "$partial"
if command -v sha256sum >/dev/null 2>&1; then
  checksum="$(sha256sum "$partial")"
else
  checksum="$(shasum -a 256 "$partial")"
fi
# Same-directory hard link publishes only a complete archive, exclusively. A
# concurrent backup cannot overwrite an existing destination (including symlinks).
link "$partial" "$output"
printf 'Database backup verified: %s\nSHA-256: %s\n' "$output" "${checksum%% *}"
