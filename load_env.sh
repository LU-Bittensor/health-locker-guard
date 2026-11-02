#!/usr/bin/env bash
# Load health-locker-guard/.env into the current shell.
#
# Usage (must be sourced so exports persist):
#   cd health-locker-guard
#   source ./load_env.sh
#
# Or from Main-Project/key-generation:
#   source ../health-locker-guard/load_env.sh   # if cloned as sibling
#   source ../../health-locker-guard/load_env.sh  # adjust path as needed

if [[ "${BASH_SOURCE[0]}" == "${0}" ]]; then
  echo "Source this script instead of executing it:" >&2
  echo "  source ${0}" >&2
  exit 1
fi

_ENV_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
_ENV_FILE="${MEDILINK_ENV_FILE:-${_ENV_DIR}/.env}"

if [[ ! -f "${_ENV_FILE}" ]]; then
  echo "Missing env file: ${_ENV_FILE}" >&2
  unset _ENV_DIR _ENV_FILE
  return 1 2>/dev/null || exit 1
fi

set -a
# shellcheck disable=SC1090
source "${_ENV_FILE}"
set +a

# grant_api expects non-VITE names; copy from VITE_* when unset.
if [[ -z "${SUPABASE_URL:-}" && -n "${VITE_SUPABASE_URL:-}" ]]; then
  export SUPABASE_URL="${VITE_SUPABASE_URL}"
fi
if [[ -z "${SUPABASE_PUBLISHABLE_KEY:-}" && -n "${VITE_SUPABASE_PUBLISHABLE_KEY:-}" ]]; then
  export SUPABASE_PUBLISHABLE_KEY="${VITE_SUPABASE_PUBLISHABLE_KEY}"
fi
if [[ -z "${SUPABASE_PROJECT_ID:-}" && -n "${VITE_SUPABASE_PROJECT_ID:-}" ]]; then
  export SUPABASE_PROJECT_ID="${VITE_SUPABASE_PROJECT_ID}"
fi

echo "Loaded ${_ENV_FILE}"
echo "  SUPABASE_URL=${SUPABASE_URL:-<unset>}"
echo "  SUPABASE_PUBLISHABLE_KEY is $([[ -n ${SUPABASE_PUBLISHABLE_KEY:-} ]] && echo set || echo unset)"

unset _ENV_DIR _ENV_FILE
