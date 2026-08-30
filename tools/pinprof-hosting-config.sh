#!/usr/bin/env bash

# Compatibility launcher. PinProf Admin is the canonical owner of static
# hosting topology; website deploys source the same values from there.
WEBSITE_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
PINPROF_ADMIN_SOURCE_ROOT="${PINPROF_ADMIN_SOURCE_ROOT:-${WEBSITE_ROOT}/../PinProf Admin}"
CANONICAL_HOSTING_CONFIG="${PINPROF_ADMIN_SOURCE_ROOT}/scripts/publish/pinprof-hosting-config.sh"
if [[ ! -f "${CANONICAL_HOSTING_CONFIG}" ]]; then
  echo "Missing canonical PinProf Admin hosting config: ${CANONICAL_HOSTING_CONFIG}" >&2
  return 1 2>/dev/null || exit 1
fi
source "${CANONICAL_HOSTING_CONFIG}"
