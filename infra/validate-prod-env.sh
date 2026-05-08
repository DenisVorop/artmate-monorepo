#!/usr/bin/env bash
set -euo pipefail

script_dir="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
required_file="${script_dir}/required-prod-env.txt"
env_files=()

usage() {
  cat >&2 <<'USAGE'
Usage: bash infra/validate-prod-env.sh --env-file <path> [--env-file <path> ...]

Validates that every required production env variable has a non-empty value.
USAGE
}

while [ "$#" -gt 0 ]; do
  case "$1" in
    --env-file)
      if [ "$#" -lt 2 ]; then
        echo "--env-file requires a path" >&2
        exit 2
      fi

      env_files+=("$2")
      shift 2
      ;;
    --required-file)
      if [ "$#" -lt 2 ]; then
        echo "--required-file requires a path" >&2
        exit 2
      fi

      required_file="$2"
      shift 2
      ;;
    -h|--help)
      usage
      exit 0
      ;;
    *)
      echo "Unknown argument: $1" >&2
      usage
      exit 2
      ;;
  esac
done

if [ "${#env_files[@]}" -eq 0 ]; then
  echo "At least one --env-file is required" >&2
  usage
  exit 2
fi

if [ ! -f "$required_file" ]; then
  echo "Required env list not found: $required_file" >&2
  exit 2
fi

for env_file in "${env_files[@]}"; do
  if [ ! -f "$env_file" ]; then
    echo "Env file not found: $env_file" >&2
    exit 2
  fi
done

awk '
function trim(value) {
  sub(/^[[:space:]]+/, "", value)
  sub(/[[:space:]]+$/, "", value)
  return value
}

function unquote(value) {
  if (value ~ /^".*"$/ || value ~ /^'\''.*'\''$/) {
    return substr(value, 2, length(value) - 2)
  }

  return value
}

BEGIN {
  for (name in ENVIRON) {
    values[name] = ENVIRON[name]
  }
}

FILENAME == ARGV[1] {
  line = $0
  sub(/\r$/, "", line)
  sub(/[[:space:]]*#.*/, "", line)
  line = trim(line)

  if (line == "") {
    next
  }

  if (line !~ /^[A-Za-z_][A-Za-z0-9_]*$/) {
    printf "Invalid required env name: %s\n", line > "/dev/stderr"
    exit 2
  }

  required[++required_count] = line
  next
}

{
  line = $0
  sub(/\r$/, "", line)

  if (line ~ /^[[:space:]]*(#|$)/) {
    next
  }

  sub(/^[[:space:]]*export[[:space:]]+/, "", line)

  if (line !~ /^[A-Za-z_][A-Za-z0-9_]*=/) {
    next
  }

  name = line
  sub(/=.*/, "", name)
  value = line
  sub(/^[^=]*=/, "", value)
  values[name] = unquote(trim(value))
}

END {
  for (i = 1; i <= required_count; i++) {
    name = required[i]
    value = (name in values) ? trim(values[name]) : ""

    if (value == "") {
      missing[++missing_count] = name
    }
  }

  if (missing_count > 0) {
    print "Missing required production env values:" > "/dev/stderr"

    for (i = 1; i <= missing_count; i++) {
      printf "  - %s\n", missing[i] > "/dev/stderr"
    }

    exit 1
  }

  printf "Production env validation passed: %d required values present.\n", required_count
}
' "$required_file" "${env_files[@]}"
